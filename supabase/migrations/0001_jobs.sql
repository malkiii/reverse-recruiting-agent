create table jobs (
  id bigint generated always as identity primary key,
  source text not null,
  title text not null,
  company_name text not null,
  location text not null,
  url text not null unique,
  post_day date not null,
  description text,
  unique (title, company_name, post_day)
);

alter table jobs enable row level security;
