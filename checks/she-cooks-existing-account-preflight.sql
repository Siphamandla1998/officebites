-- PREPARED SELECT ONLY. Use the independently verified production project for the
-- actual existing vendor, and staging separately for an approved synthetic account.
-- No signup, become_vendor invocation, approval, linking UPDATE or banking mutation.
WITH candidate AS (
 SELECT v.id,v.owner_id,v.status,v.archived_at,p.id profile_id,p.vendor_id linked_vendor,p.role,p.suspended,p.deleted_at,
 EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v.owner_id) auth_identity_exists,
 (SELECT count(*) FROM public.vendors x WHERE x.owner_id=v.owner_id) owned_vendor_count
 FROM public.vendors v LEFT JOIN public.profiles p ON p.id=v.owner_id
 WHERE regexp_replace(upper(trim(v.name)),'\s+',' ','g')='SHE COOKS BY SNE'
)
SELECT count(*) candidate_count,coalesce(bool_and(auth_identity_exists),false) auth_exists,
 coalesce(bool_and(profile_id=owner_id AND linked_vendor=id AND role='vendor'),false) ownership_link_valid,
 coalesce(bool_and(NOT suspended AND deleted_at IS NULL AND archived_at IS NULL),false) account_not_removed_or_suspended,
 coalesce(bool_and(owned_vendor_count=1),false) one_vendor_per_owner,
 string_agg(DISTINCT status::text,',') vendor_status FROM candidate;
-- Expected: exactly one candidate; all identity/link booleans true.
-- A false/suspended result is an owner/admin review, NEVER duplicate registration.
-- Existing approval is not proof of new manual-payment/legal/compliance readiness.
