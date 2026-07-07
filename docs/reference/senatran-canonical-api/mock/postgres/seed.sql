insert into renach_process
(renach_number, cpf, process_type, status, current_category, requested_category, opened_at, expires_at)
values
('RS123456789', '00000000000', 'RENEWAL', 'AWAITING_MEDICAL', 'B', 'B', now(), now() + interval '1 year');

-- Add test AIT through API or insert JSON payloads manually.
