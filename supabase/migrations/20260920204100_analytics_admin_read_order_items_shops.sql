-- P1 Analytics: allow authenticated admins to read the order details needed
-- for platform-level revenue/COGS reporting without granting write access.

CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::text)));

CREATE POLICY "Admins can view all shops"
ON public.shops
FOR SELECT
TO authenticated
USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::text)));
