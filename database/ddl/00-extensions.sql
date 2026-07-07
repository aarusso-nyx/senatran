-- SENATRAN mock — extensions.
-- pgcrypto: digest() for audit payload hashes. uuid-ossp: transactional PKs.
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
