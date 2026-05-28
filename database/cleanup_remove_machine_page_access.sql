-- Removes obsolete machine page permissions from stored user access JSON.
-- Safe to run multiple times.

UPDATE user_accesses
SET
  allowed_pages_json = COALESCE(
    (
      SELECT jsonb_agg(page_value)
      FROM jsonb_array_elements_text(
        COALESCE(NULLIF(TRIM(allowed_pages_json), ''), '[]')::jsonb
      ) AS page_value
      WHERE page_value NOT IN (
        '/products/general-machine.html',
        '/products/add-general-machine.html',
        '/products/edit-general-machine.html',
        '/products/machine.html',
        '/products/add-rental-machine.html',
        '/products/edit-rental-machine.html'
      )
    ),
    '[]'::jsonb
  )::text,
  allowed_actions_json = COALESCE(
    (
      SELECT jsonb_agg(action_value)
      FROM jsonb_array_elements_text(
        COALESCE(NULLIF(TRIM(allowed_actions_json), ''), '[]')::jsonb
      ) AS action_value
      WHERE action_value !~* '^/products/(general-machine|add-general-machine|edit-general-machine|machine|add-rental-machine|edit-rental-machine)\.html::'
    ),
    '[]'::jsonb
  )::text;
