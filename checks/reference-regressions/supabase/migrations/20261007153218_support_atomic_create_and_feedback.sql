-- Match the existing feedback page without exposing guest submissions.
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment text CHECK(char_length(comment)<=5000),
  recommend boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_user_id_idx ON public.feedback(user_id);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback FROM anon, authenticated;
GRANT INSERT(id,user_id,rating,comment,recommend) ON public.feedback TO anon, authenticated;
GRANT SELECT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
CREATE POLICY feedback_submit ON public.feedback FOR INSERT TO anon, authenticated
  WITH CHECK(user_id IS NOT DISTINCT FROM (SELECT auth.uid()));
CREATE POLICY feedback_read ON public.feedback FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()) OR (SELECT private.is_admin()));

-- Invoker rights preserve ticket/message RLS; both inserts commit together.
CREATE FUNCTION public.create_support_ticket(
  p_subject text, p_category text, p_body text,
  p_requester_name text, p_requester_email text, p_requester_contact text,
  p_order_id uuid DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb,
  p_attachment_path text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE caller uuid:=auth.uid(); ticket public.support_tickets%rowtype; message public.support_ticket_messages%rowtype;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Please sign in before contacting support' USING ERRCODE='42501'; END IF;
  IF length(btrim(coalesce(p_subject,''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Subject must be between 1 and 200 characters'; END IF;
  IF length(btrim(coalesce(p_body,''))) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Message must be between 1 and 5000 characters'; END IF;
  IF p_attachment_path IS NOT NULL AND split_part(p_attachment_path,'/',1)<>caller::text THEN
    RAISE EXCEPTION 'Attachment must belong to the requester' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.support_tickets(requester_id,requester_name,requester_email,requester_contact,subject,category,order_id,meta,attachment_url)
  VALUES(caller,coalesce(nullif(btrim(p_requester_name),''),'Customer'),nullif(btrim(p_requester_email),''),nullif(btrim(p_requester_contact),''),btrim(p_subject),p_category,p_order_id,coalesce(p_meta,'{}'::jsonb),p_attachment_path)
  RETURNING * INTO ticket;
  INSERT INTO public.support_ticket_messages(ticket_id,sender_id,sender_role,body,internal)
  VALUES(ticket.id,caller,'customer',btrim(p_body),false) RETURNING * INTO message;
  RETURN to_jsonb(ticket) || jsonb_build_object('support_ticket_messages',jsonb_build_array(to_jsonb(message)));
END;
$$;
REVOKE ALL ON FUNCTION public.create_support_ticket(text,text,text,text,text,text,uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text,text,text,text,text,text,uuid,jsonb,text) TO authenticated;
