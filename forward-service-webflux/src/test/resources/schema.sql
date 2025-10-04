CREATE TABLE IF NOT EXISTS forward_log (
    id UUID PRIMARY KEY,
    log_date TIMESTAMP NOT NULL,
    pod_name VARCHAR(255) NOT NULL,
    http_status INT NOT NULL
);
