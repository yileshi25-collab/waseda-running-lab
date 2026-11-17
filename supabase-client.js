/* One Auth client per page, shared by all community features. */
(() => {
  let client;
  window.WSD_GET_SUPABASE = () => {
    if (!client) {
      client = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm')
        .then(({createClient}) => {
          const cfg = window.WSD_COMMUNITY_CONFIG;
          return createClient(cfg.url, cfg.publishableKey, {
            auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
          });
        }).catch(error => { client = null; throw error; });
    }
    return client;
  };
})();
