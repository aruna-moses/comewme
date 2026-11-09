import { supabase } from './supabase'

/**
 * Submit an SOS alert for a task.
 *
 * @param taskId - The task the user is in
 * @param profile - The signed-in user's profile
 * @param location - { latitude, longitude, address? }
 * @param mediaFile - Optional image or video file
 */
export async function submitSOS(
  taskId: string,
  profile: { id: string; display_name: string },
  location: { latitude: number; longitude: number; address?: string },
  mediaFile: File | null = null,
) {
  let mediaUrl: string | null = null;
  let mediaType: 'image' | 'video' | null = null;

  if (mediaFile) {
    const isImage = mediaFile.type.startsWith('image/');
    const isVideo = mediaFile.type.startsWith('video/');
    if (!isImage && !isVideo) {
      throw new Error('Only images and videos are supported.');
    }
    const safeName = mediaFile.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `sos/${profile.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(path, mediaFile);
    if (uploadError) throw uploadError;
    const { data } = await supabase.storage.from('chat-media').getPublicUrl(path);
    mediaUrl = data.publicUrl;
    mediaType = isImage ? 'image' : 'video';
  }

  const { error } = await supabase.from('sos_alerts').insert({
    task_id: taskId,
    user_id: profile.id,
    location_lat: location.latitude,
    location_lng: location.longitude,
    location_address: location.address ?? null,
    media_url: mediaUrl,
    media_type: mediaType,
    status: 'pending',
  });
  if (error) throw error;
}

/** Fetch the current user's own SOS alerts. */
export async function fetchMySOSAlerts() {
  const { data, error } = await supabase
    .from('sos_alerts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    user_id: string;
    task_id: string;
    location_lat: number | null;
    location_lng: number | null;
    location_address: string | null;
    media_url: string | null;
    media_type: 'image' | 'video' | null;
    status: 'pending' | 'reviewed' | 'resolved' | 'false_alarm';
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    admin_note: string | null;
  }>;
}

/** Admin-only: fetch all SOS alerts. Should be called with service role or admin context. */
export async function fetchAllSOSAlerts() {
  const { data, error } = await supabase
    .from('sos_alerts')
    .select('*, profiles(display_name, username)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    user_id: string;
    profiles: { display_name: string | null; username: string | null } | null;
    task_id: string;
    location_lat: number | null;
    location_lng: number | null;
    location_address: string | null;
    media_url: string | null;
    media_type: 'image' | 'video' | null;
    status: 'pending' | 'reviewed' | 'resolved' | 'false_alarm';
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    admin_note: string | null;
  }>;
}

/** Admin-only: update an SOS alert status. */
export async function updateSOSAlert(
  alertId: string,
  status: 'reviewed' | 'resolved' | 'false_alarm',
  adminNote: string | null,
) {
  const { error } = await supabase
    .from('sos_alerts')
    .update({
      status,
      admin_note: adminNote,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', alertId);
  if (error) throw error;
}
