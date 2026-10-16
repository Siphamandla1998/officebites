-- Forward-only metadata repair for Windows CP1252 transport of the UTF-8 em dash.
-- ASCII SQL avoids depending on shell output encoding. No policy/fee/approval changes.
BEGIN;
ALTER TABLE private.delivery_settings ALTER COLUMN hub_name SET DEFAULT U&'OfficeBites \2014 Eduvos Umhlanga';
UPDATE private.delivery_settings SET hub_name=U&'OfficeBites \2014 Eduvos Umhlanga'
 WHERE hub_name=U&'OfficeBites \00E2\20AC\201D Eduvos Umhlanga';
COMMIT;
