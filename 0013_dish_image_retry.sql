-- Resume jobs stopped by the old three-attempt policy, retaining existing artwork.
UPDATE dish_images SET status='queued',attempts=0,next_attempt=0,lease=NULL,error=''
 WHERE status='error';
-- Only release an idle cooldown; never interrupt an active generation lease.
UPDATE dish_image_lock SET expires=0 WHERE lease IS NULL;
