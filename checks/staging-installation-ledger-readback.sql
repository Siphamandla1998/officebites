-- PREPARED SELECT ONLY; NOT executed hosted. Use after both approved staging steps.
-- Compare recorded canonical SQL, not merely migration names or statement counts.
SELECT e.version,e.name expected_name,m.name recorded_name,
 cardinality(m.statements) recorded_statement_count,
 md5(m.statements[1]) recorded_sql_md5,e.expected_md5,
 (m.name=e.name AND cardinality(m.statements)=1 AND md5(m.statements[1])=e.expected_md5) exact_artifact_match
FROM (VALUES
 ('20261027123110','staging_integrated_vendor_legal_payments','9bbbbb1380a0d9faaddc7f3bd2f29eaf'),
 ('20261027123115','staging_compliance_storage_policies','0f776467fca615a33fe8ec012b6bb3a3')
) e(version,name,expected_md5)
LEFT JOIN supabase_migrations.schema_migrations m ON m.version=e.version
ORDER BY e.version;
-- Expected: two rows, both exact_artifact_match=true; history 56 in postflight.
-- MD5 is a consistency comparison only. SHA-256 package identity remains in manifest.
