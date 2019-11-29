--name: unique users by @date
--input: string date { pattern: datetime }
--connection: datagrok
select u.name, u.id from events e
inner join users_sessions s on e.session_id = s.id
inner join users u on u.id = s.user_id
where @date(e.event_time)
group by u.name, u.id
--end


--name: events on @date
--input: string date { pattern: datetime }
--connection: datagrok
select u.email as user, u.id as user_id, t.name, t.source, e.event_time, e.description from events e
inner join event_types t on e.event_type_id = t.id
inner join users_sessions s on e.session_id = s.id
inner join users u on u.id = s.user_id
where @date(e.event_time)
order by e.event_time desc
--end


--name: errors on @date
--input: string date { pattern: datetime }
--connection: datagrok
select * from events e
where @date(e.event_time) and e.error_stack_trace is not null
--end


--name: events summary on @date
--input: string date { pattern: datetime }
--connection: datagrok
select et.friendly_name, count(et.friendly_name) from events e
inner join event_types et on e.event_type_id = et.id
where @date(e.event_time)
group by et.friendly_name
order by count(et.friendly_name) desc
--end


--name: errors summary on @date
--input: string date { pattern: datetime }
--connection: datagrok
select concat(e.friendly_name, ': ', e.error_message), count(et.friendly_name) from events e
join event_types et on e.event_type_id = et.id
where @date(e.event_time) and e.error_stack_trace is not null
group by concat(e.friendly_name, ': ', e.error_message)
order by count(et.friendly_name) desc
--end


--name: manual activity by @date
--input: string date { pattern: datetime }
select ta.date, ts.file_name, ta.result, ta.error_desc as error
from test_activity ta
join test_scenario ts on ts.id = ta.scenario_id
where @date(ta.date) and ts.type = 'manual'
order by ta.date desc
--end
