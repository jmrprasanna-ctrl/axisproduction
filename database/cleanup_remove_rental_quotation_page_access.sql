-- Removes retired rental/count/quotation page permissions from stored user access JSON.
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
        '/products/add-rental-count.html',
        '/products/add-rental-consumable.html',
        '/products/edit-added-consumable.html',
        '/invoices/view-quotation.html',
        '/invoices/view-quotation-2.html',
        '/invoices/view-quotation-3.html'
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
      WHERE action_value !~* '^/(products/(add-rental-count|add-rental-consumable|edit-added-consumable)|invoices/(view-quotation|view-quotation-2|view-quotation-3))\.html::'
    ),
    '[]'::jsonb
  )::text;
