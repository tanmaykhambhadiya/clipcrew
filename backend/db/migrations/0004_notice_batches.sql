-- One send of a notice = one batch_id shared by every recipient row, so the history can show
-- "sent to N clippers, M have read it".
alter table notifications add column batch_id uuid;
create index on notifications (batch_id) where batch_id is not null;
