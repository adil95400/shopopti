-- P0 pure utility function hardening.
-- These immutable text-masking helpers do not access privileged tables.
-- Run them as the caller instead of the function owner.

ALTER FUNCTION public.mask_customer_email(text) SECURITY INVOKER;
ALTER FUNCTION public.mask_customer_phone(text) SECURITY INVOKER;
ALTER FUNCTION public.mask_email(text) SECURITY INVOKER;
ALTER FUNCTION public.mask_phone(text) SECURITY INVOKER;
ALTER FUNCTION public.simple_mask_email(text) SECURITY INVOKER;
ALTER FUNCTION public.simple_mask_phone(text) SECURITY INVOKER;
