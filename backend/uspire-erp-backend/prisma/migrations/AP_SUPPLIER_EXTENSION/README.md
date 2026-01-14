AP Supplier Extension Migration Notes
1) Run prisma migrate dev to create the new tables.
2) No seed changes required unless you want demo supplier docs/bank accounts.
3) Manual QA:
   - Create supplier
   - Upload KYC doc (verify list + download + deactivate)
   - Add bank account (set primary, edit, deactivate)
   - Confirm change history logs are created for each action
   - Confirm tenant scoping by switching tenant (if supported)
4) Confirm no changes to AP invoice/payments workflows.
