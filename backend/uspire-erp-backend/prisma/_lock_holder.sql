SELECT a.pid,
       a.usename,
       a.application_name,
       a.client_addr,
       a.state,
       a.query_start,
       now() - a.query_start AS query_age,
       left(a.query, 200) AS query
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory'
  AND l.classid = 0
  AND l.objid = 72707369;
