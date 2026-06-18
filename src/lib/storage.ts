import { supabase } from './supabase';

/**
 * Uploads multiple files to Supabase Storage and returns their public URLs.
 * @param files Array of File objects to upload
 * @returns Array of public URLs
 */
export async function uploadTodoImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    // Generate a unique filename to prevent overwriting
    const fileExt = file.name.split('.').pop();
    const rand = Math.random().toString(36).substring(2, 10);
    const fileName = `${Date.now()}-${rand}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Upload to 'todo-images' bucket
    const { error: uploadError } = await supabase.storage
      .from('todo-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading file to Supabase storage:', uploadError);
      throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
    }

    // Get the public URL for the uploaded file
    const { data } = supabase.storage
      .from('todo-images')
      .getPublicUrl(filePath);

    if (data?.publicUrl) {
      urls.push(data.publicUrl);
    }
  }

  return urls;
}

/**
 * Extracts the filepath from a Supabase Storage public URL.
 * @param publicUrl Public URL of the file
 * @returns Storage file path e.g. "uploads/filename.jpg"
 */
function getFilePathFromUrl(publicUrl: string): string | null {
  try {
    const marker = '/todo-images/';
    const index = publicUrl.indexOf(marker);
    if (index === -1) return null;
    return publicUrl.substring(index + marker.length);
  } catch (error) {
    console.error('Error parsing public URL:', error);
    return null;
  }
}

/**
 * Deletes multiple files from Supabase Storage using their public URLs.
 * @param urls Array of public URLs to delete
 */
export async function deleteTodoImages(urls: string[]): Promise<void> {
  const pathsToDelete = urls
    .map(url => getFilePathFromUrl(url))
    .filter((path): path is string => path !== null);

  if (pathsToDelete.length === 0) return;

  const { error } = await supabase.storage
    .from('todo-images')
    .remove(pathsToDelete);

  if (error) {
    console.error('Error deleting files from Supabase storage:', error);
  }
}
