CREATE INDEX "published_items_workspace_id_reddit_account_id_type_idx"
ON "published_items"("workspace_id", "reddit_account_id", "type");

CREATE INDEX "published_items_workspace_id_reddit_account_id_subreddit_id_type_idx"
ON "published_items"("workspace_id", "reddit_account_id", "subreddit_id", "type");
