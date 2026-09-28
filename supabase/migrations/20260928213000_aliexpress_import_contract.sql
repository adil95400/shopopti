-- AliExpress import snapshot + commercial draft persistence.
-- Mirrors the staging runtime validated for PR #214.

create or replace function public.enqueue_import_pipeline_snapshot_job(
  p_idempotency_key text,
  p_source_id text,
  p_source_product_id text default null,
  p_source_url text default null,
  p_destination_id text default 'draft',
  p_max_attempts integer default 5,
  p_extracted_product jsonb default null
)
returns table(job_id uuid, created boolean, stage text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result record;
  v_existing jsonb;
  v_snapshot_source_id text;
  v_snapshot_product_id text;
  v_snapshot_url text;
  v_title text;
begin
  if v_user_id is null then
    raise exception 'IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_extracted_product is null or jsonb_typeof(p_extracted_product) <> 'object' then
    raise exception 'IMPORT_SNAPSHOT_REQUIRED' using errcode = '22023';
  end if;

  if p_extracted_product ->> 'contract' <> 'shopopti_extracted_product_v1' then
    raise exception 'IMPORT_SNAPSHOT_CONTRACT_INVALID' using errcode = '22023';
  end if;

  if pg_column_size(p_extracted_product) > 1000000 then
    raise exception 'IMPORT_SNAPSHOT_TOO_LARGE' using errcode = '22023';
  end if;

  v_snapshot_source_id := lower(btrim(coalesce(p_extracted_product #>> '{source,id}', '')));
  v_snapshot_product_id := nullif(btrim(coalesce(p_extracted_product #>> '{source,product_id}', '')), '');
  v_snapshot_url := nullif(btrim(coalesce(p_extracted_product #>> '{source,requested_url}', '')), '');
  v_title := btrim(coalesce(p_extracted_product #>> '{product,title}', ''));

  if v_title = '' or length(v_title) > 1000 then
    raise exception 'IMPORT_SNAPSHOT_TITLE_INVALID' using errcode = '22023';
  end if;

  if v_snapshot_source_id <> lower(btrim(p_source_id)) then
    raise exception 'IMPORT_SNAPSHOT_SOURCE_MISMATCH' using errcode = '22023';
  end if;

  if nullif(btrim(p_source_product_id), '') is not null
     and v_snapshot_product_id is distinct from nullif(btrim(p_source_product_id), '') then
    raise exception 'IMPORT_SNAPSHOT_PRODUCT_ID_MISMATCH' using errcode = '22023';
  end if;

  if nullif(btrim(p_source_url), '') is not null
     and v_snapshot_url is distinct from nullif(btrim(p_source_url), '') then
    raise exception 'IMPORT_SNAPSHOT_URL_MISMATCH' using errcode = '22023';
  end if;

  if jsonb_typeof(p_extracted_product #> '{product,images}') = 'array'
     and jsonb_array_length(p_extracted_product #> '{product,images}') > 50 then
    raise exception 'IMPORT_SNAPSHOT_IMAGES_LIMIT' using errcode = '22023';
  end if;

  if jsonb_typeof(p_extracted_product #> '{product,variants}') = 'array'
     and jsonb_array_length(p_extracted_product #> '{product,variants}') > 200 then
    raise exception 'IMPORT_SNAPSHOT_VARIANTS_LIMIT' using errcode = '22023';
  end if;

  select *
  into v_result
  from public.enqueue_import_pipeline_job(
    p_idempotency_key,
    p_source_id,
    p_source_product_id,
    p_source_url,
    p_destination_id,
    p_max_attempts
  );

  select s.extracted_product
  into v_existing
  from public.import_pipeline_states s
  where s.job_id = v_result.job_id
    and s.user_id = v_user_id;

  if v_existing is not null and v_existing is distinct from p_extracted_product then
    raise exception 'IMPORT_SNAPSHOT_CONFLICT' using errcode = '40900';
  end if;

  if v_existing is null then
    update public.import_pipeline_states s
    set extracted_product = p_extracted_product,
        updated_at = now()
    where s.job_id = v_result.job_id
      and s.user_id = v_user_id
      and s.stage = 'QUEUED';

    if not found then
      raise exception 'IMPORT_SNAPSHOT_STAGE_IMMUTABLE' using errcode = '55000';
    end if;
  end if;

  return query
  select v_result.job_id, v_result.created, v_result.stage;
end;
$function$;

revoke all on function public.enqueue_import_pipeline_snapshot_job(
  text, text, text, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.enqueue_import_pipeline_snapshot_job(
  text, text, text, text, text, integer, jsonb
) to authenticated;

create or replace function public.persist_aliexpress_commercial_fields(
  p_draft_id uuid,
  p_user_id uuid,
  p_normalized jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
begin
  update public.imported_products
  set
    compare_at_price = case when jsonb_typeof(p_normalized->'compareAtPrice')='number'
      then (p_normalized->>'compareAtPrice')::numeric else null end,
    gtin = nullif(p_normalized#>>'{identifiers,gtin}',''),
    ean = nullif(p_normalized#>>'{identifiers,ean}',''),
    upc = nullif(p_normalized#>>'{identifiers,upc}',''),
    barcode = coalesce(
      nullif(p_normalized#>>'{identifiers,gtin}',''),
      nullif(p_normalized#>>'{identifiers,ean}',''),
      nullif(p_normalized#>>'{identifiers,upc}','')
    ),
    seller_info = case
      when jsonb_typeof(p_normalized->'supplier')='object'
        then p_normalized->'supplier'
      when nullif(p_normalized->>'seller','') is not null
        then jsonb_build_object('name',nullif(p_normalized->>'seller',''))
      else '{}'::jsonb
    end,
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'mpn', nullif(p_normalized#>>'{identifiers,mpn}',''),
      'promotion', coalesce(p_normalized->'promotion','{}'::jsonb),
      'canonical_url', nullif(p_normalized->>'canonicalUrl',''),
      'minimum_order_quantity', case when jsonb_typeof(p_normalized->'minimumOrderQuantity')='number'
        then p_normalized->'minimumOrderQuantity' else 'null'::jsonb end,
      'pack_size', case when jsonb_typeof(p_normalized->'packSize')='number'
        then p_normalized->'packSize' else 'null'::jsonb end,
      'condition', nullif(p_normalized->>'condition',''),
      'tax_included', case when jsonb_typeof(p_normalized->'taxIncluded')='boolean'
        then p_normalized->'taxIncluded' else 'null'::jsonb end,
      'price_country', nullif(p_normalized->>'priceCountry',''),
      'sold_count', case when jsonb_typeof(p_normalized->'soldCount')='number'
        then p_normalized->'soldCount' else 'null'::jsonb end,
      'review_distribution', coalesce(p_normalized->'reviewDistribution','null'::jsonb),
      'review_pagination', coalesce(p_normalized->'reviewPagination','null'::jsonb)
    ),
    updated_at=now()
  where id=p_draft_id and user_id=p_user_id;

  return found;
end;
$function$;

revoke execute on function public.persist_aliexpress_commercial_fields(uuid,uuid,jsonb)
from public, anon, authenticated;
grant execute on function public.persist_aliexpress_commercial_fields(uuid,uuid,jsonb)
to service_role;

create or replace function public.persist_ready_import_pipeline_draft(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_state public.import_pipeline_states%rowtype;
  v_job public.jobs%rowtype;
  v_supplier_product_id text;
  v_existing_id uuid;
  v_marked boolean := false;
  v_result jsonb;
  v_draft_id uuid;
begin
  if nullif(btrim(coalesce(p_worker_id, '')), '') is null or p_lease_token is null then
    raise exception 'IMPORT_DRAFT_PERSISTENCE_LEASE_REQUIRED' using errcode = '42501';
  end if;

  select s.*
  into v_state
  from public.import_pipeline_states s
  where s.job_id = p_job_id
  for update;

  if not found then
    raise exception 'IMPORT_PIPELINE_JOB_NOT_FOUND';
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.user_id = v_state.user_id
  for update;

  if not found then
    raise exception 'IMPORT_PIPELINE_JOB_HEADER_NOT_FOUND';
  end if;

  if v_state.stage <> 'READY' then
    raise exception 'IMPORT_DRAFT_PERSISTENCE_STAGE_NOT_READY';
  end if;

  if v_state.lease_token is distinct from p_lease_token
     or v_state.lease_owner is distinct from p_worker_id
     or v_state.lease_expires_at is null
     or v_state.lease_expires_at <= now() then
    raise exception 'IMPORT_DRAFT_PERSISTENCE_LEASE_INVALID' using errcode = '42501';
  end if;

  v_supplier_product_id := coalesce(
    nullif(v_state.normalized_product#>>'{identifiers,sourceProductId}', ''),
    v_state.source_product_id
  );

  if v_supplier_product_id is not null then
    select ip.id
    into v_existing_id
    from public.imported_products ip
    where ip.user_id = v_state.user_id
      and ip.supplier_product_id = v_supplier_product_id
    limit 1;
  end if;

  if v_existing_id is not null then
    update public.jobs
    set
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'draft_persistence_code', 'already_imported',
        'existing_draft_id', v_existing_id
      ),
      updated_at = now()
    where id = p_job_id
      and user_id = v_state.user_id
      and coalesce(metadata->>'draft_persistence_code', '') <> 'already_imported'
    returning true into v_marked;

    if coalesce(v_job.metadata->>'schedule_mode', '') = 'feed_xml'
       and v_marked then
      perform public.complete_scheduled_import_child(p_job_id);
    end if;

    return jsonb_build_object(
      'success', true,
      'code', 'already_imported',
      'draft_id', v_existing_id
    );
  end if;

  v_result := public.persist_ready_import_pipeline_draft_strict_legacy(
    p_job_id,
    p_lease_token,
    p_worker_id
  );

  begin
    v_draft_id := nullif(v_result->>'draft_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'IMPORT_DRAFT_ID_INVALID' using errcode = '22023';
  end;

  if v_draft_id is null then
    raise exception 'IMPORT_DRAFT_ID_MISSING';
  end if;

  update public.imported_products ip
  set
    keywords = array(
      select value
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(v_state.normalized_product->'sourceKeywords') = 'array'
            then v_state.normalized_product->'sourceKeywords'
          else '[]'::jsonb
        end
      ) as kw(value)
      limit 50
    ),
    tags = array(
      select value
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(v_state.normalized_product->'sourceTags') = 'array'
            then v_state.normalized_product->'sourceTags'
          else '[]'::jsonb
        end
      ) as tag(value)
      limit 30
    ),
    metadata = coalesce(ip.metadata, '{}'::jsonb) || jsonb_build_object(
      'source_keywords_imported', true,
      'source_keywords_count',
        case
          when jsonb_typeof(v_state.normalized_product->'sourceKeywords') = 'array'
            then jsonb_array_length(v_state.normalized_product->'sourceKeywords')
          else 0
        end,
      'source_tags_count',
        case
          when jsonb_typeof(v_state.normalized_product->'sourceTags') = 'array'
            then jsonb_array_length(v_state.normalized_product->'sourceTags')
          else 0
        end
    ),
    updated_at = now()
  where ip.id = v_draft_id
    and ip.user_id = v_state.user_id;

  if not found then
    raise exception 'IMPORT_DRAFT_KEYWORDS_PERSISTENCE_FAILED';
  end if;

  if v_state.source_id = 'aliexpress' then
    if not public.persist_aliexpress_commercial_fields(
      v_draft_id,
      v_state.user_id,
      coalesce(v_state.normalized_product, '{}'::jsonb)
    ) then
      raise exception 'IMPORT_ALIEXPRESS_COMMERCIAL_PERSISTENCE_FAILED';
    end if;
  end if;

  return v_result;
end;
$function$;

revoke execute on function public.persist_ready_import_pipeline_draft(uuid,uuid,text)
from public, anon, authenticated;
grant execute on function public.persist_ready_import_pipeline_draft(uuid,uuid,text)
to service_role;
