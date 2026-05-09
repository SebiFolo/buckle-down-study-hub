import { supabase } from "@/integrations/supabase/client";

export async function friendsCall<T = any>(
  action: string,
  payload: Record<string, any> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("friends-action", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}
