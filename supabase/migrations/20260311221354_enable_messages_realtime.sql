/*
  # Enable Realtime for Messages

  1. Changes
    - Enable Realtime replication for messages table
    - This allows real-time subscriptions to work properly
  
  2. Notes
    - Without this, Realtime subscriptions won't receive updates
    - This is required for chat to work without page refresh
*/

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
