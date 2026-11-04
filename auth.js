'use strict';
(function(root){
  class AccessError extends Error {constructor(code,message){super(message);this.name='AccessError';this.code=code;}}
  let client=null,authorized=false,ownerId=null;
  function configuration(){
    const config=root.PLANNER_CONFIG||{};
    if(!config.supabaseUrl||!config.publishableKey)throw new AccessError('SETUP','Осталось подключить вход через GitHub.');
    const url=new URL(config.supabaseUrl);
    if(url.protocol!=='https:'||!/[.]supabase[.]co$/.test(url.hostname)||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw new AccessError('SETUP','Неверный адрес проекта Supabase.');
    const key=String(config.publishableKey);
    if(!key.startsWith('sb_publishable_')){
      try{const claim=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(claim.role!=='anon')throw new Error();}
      catch{throw new AccessError('SETUP','Нужен публичный ключ Supabase, не секретный ключ.');}
    }
    if(config.bucket!=='planner-private')throw new AccessError('SETUP','Неверное хранилище приложения.');
    return {...config,supabaseUrl:url.origin};
  }
  function getClient(){
    if(client)return client;
    const config=configuration();
    if(!root.supabase?.createClient)throw new AccessError('SETUP','Не удалось загрузить модуль входа.');
    client=root.supabase.createClient(config.supabaseUrl,config.publishableKey,{
      auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:root.sessionStorage,storageKey:'planner-web-github-session'},
      global:{fetch:(input,options={})=>root.fetch(input,{...options,cache:'no-store',credentials:'omit'})}
    });
    return client;
  }
  async function signIn(){
    const callback=new URL(root.location.pathname,root.location.origin).href;
    const {error}=await getClient().auth.signInWithOAuth({provider:'github',options:{redirectTo:callback}});
    if(error)throw new AccessError('AUTH','Не удалось перейти ко входу GitHub. Повтори попытку.');
  }
  async function authorizeOwner(){
    authorized=false;ownerId=null;
    const api=getClient();
    const {data:session,error:sessionError}=await api.auth.getSession();
    if(sessionError||!session?.session)throw new AccessError('LOGIN','Войди через GitHub, чтобы открыть поездку.');
    const {data:identity,error:userError}=await api.auth.getUser();
    if(userError||!identity?.user)throw new AccessError('LOGIN','Сеанс истёк. Войди через GitHub снова.');
    const {data:isOwner,error:permissionError}=await api.rpc('planner_is_owner');
    if(permissionError)throw new AccessError('POLICY','Проверка доступа ещё не подключена или временно недоступна.');
    if(isOwner!==true)throw new AccessError('DENIED','Этому аккаунту доступ закрыт. Войди как silverpomor-coder.');
    authorized=true;ownerId=identity.user.id;
    return {id:ownerId};
  }
  function validPath(path){return path==='current.json'||/^(?:releases\/[0-9TZ-]+\/)?assets\/[a-f0-9]{20}\.(jpg|jpeg|png|mp3|pdf)$/.test(path);}
  async function download(path){
    if(!authorized)throw new AccessError('LOGIN','Сначала войди через GitHub.');
    if(!validPath(path))throw new AccessError('FORMAT','Некорректный путь файла.');
    const {data:blob,error}=await getClient().storage.from(configuration().bucket).download(path);
    if(error){if(error.statusCode==='401'||error.statusCode==='403'||error.status===401||error.status===403)throw new AccessError('DENIED','Доступ к файлу закрыт. Войди снова.');throw new AccessError('STORAGE','Не удалось открыть файл. Проверь подключение или повтори позже.');}
    return blob;
  }
  async function loadSnapshot(){
    const blob=await download('current.json');let data;
    try{data=JSON.parse(await blob.text());}catch{throw new AccessError('FORMAT','Сохранённая копия повреждена.');}
    if(data.version!==1||data.trip?.id!=='rome-2026'||!Array.isArray(data.pois)||!data.pois.every(p=>p.country==='IT'))throw new AccessError('FORMAT','Сохранённая копия не соответствует поездке.');
    return data;
  }
  async function signOut(){authorized=false;ownerId=null;if(client){const {error}=await client.auth.signOut({scope:'local'});if(error)throw new AccessError('AUTH','Не удалось завершить сеанс. Закрой эту вкладку.');}}
  function onSignOut(callback){return getClient().auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){authorized=false;ownerId=null;callback();}}).data.subscription;}
  root.PlannerAuth=Object.freeze({configuration,getClient,signIn,authorizeOwner,download,loadSnapshot,signOut,onSignOut,AccessError});
})(window);
