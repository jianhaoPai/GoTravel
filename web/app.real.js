const CATEGORIES = ['全部', '景点', '餐厅', '街区', '购物'];
const COLORS = ['#0F766E', '#2563EB', '#D97706', '#7C3AED', '#BE123C', '#15803D'];

const emptyState = {
  trip: null,
  members: [],
  places: [],
  wants: [],
  comments: [],
  routePlaceIds: []
};

const demoState = {
  trip: {
    id: 'demo-trip',
    name: '上海周末漫游',
    city: '上海',
    dateRange: '6月28日 - 6月30日',
    center: [31.2304, 121.4737],
    inviteCode: 'DEMO88'
  },
  members: [
    { userId: 'local-user', name: '我', color: '#0F766E', role: 'owner' },
    { userId: 'friend-chen', name: '阿辰', color: '#2563EB', role: 'member' },
    { userId: 'friend-lin', name: '林林', color: '#D97706', role: 'member' }
  ],
  places: [
    {
      id: 'place-yuyuan',
      name: '豫园',
      address: '上海市黄浦区福佑路168号',
      lat: 31.2272,
      lng: 121.4922,
      category: '景点',
      note: '适合下午去，附近可以顺便吃小笼。',
      createdBy: 'friend-chen'
    },
    {
      id: 'place-bund',
      name: '外滩',
      address: '上海市黄浦区中山东一路',
      lat: 31.2401,
      lng: 121.4908,
      category: '景点',
      note: '晚上看夜景，拍照位置多。',
      createdBy: 'local-user'
    },
    {
      id: 'place-wukang',
      name: '武康路',
      address: '上海市徐汇区武康路',
      lat: 31.2094,
      lng: 121.4443,
      category: '街区',
      note: '咖啡店多，适合慢慢逛。',
      createdBy: 'friend-lin'
    }
  ],
  wants: [
    { placeId: 'place-yuyuan', userId: 'local-user' },
    { placeId: 'place-yuyuan', userId: 'friend-chen' },
    { placeId: 'place-yuyuan', userId: 'friend-lin' },
    { placeId: 'place-bund', userId: 'local-user' },
    { placeId: 'place-bund', userId: 'friend-chen' },
    { placeId: 'place-wukang', userId: 'friend-lin' }
  ],
  comments: [
    { id: 'comment-1', placeId: 'place-yuyuan', userId: 'friend-lin', content: '这里可以和城隍庙一起排。' },
    { id: 'comment-2', placeId: 'place-yuyuan', userId: 'local-user', content: '我想吃南翔馒头店。' }
  ],
  routePlaceIds: ['place-wukang', 'place-yuyuan', 'place-bund']
};

const app = {
  state: structuredClone(demoState),
  filters: { member: 'all', category: '全部' },
  map: null,
  markers: new Map(),
  routeLine: null,
  routeMode: 'walking',
  routeMetric: null,
  routeSearchToken: 0,
  selectedPlaceId: null,
  placeDraft: null,
  placeSearch: null,
  autoComplete: null,
  joinedTrips: [],
  supabase: null,
  session: null,
  user: null,
  isAdmin: false,
  mapInitPromise: null,
  roomWasVisible: false,
  mode: 'demo'
};

const $ = (id) => document.getElementById(id);

function isVisible(id) {
  const element = $(id);
  return Boolean(element && !element.closest('[hidden]') && element.getClientRects().length);
}

function valueFromInputs(ids) {
  const visibleId = ids.find((id) => isVisible(id) && $(id).value.trim());
  if (visibleId) return $(visibleId).value.trim();

  const fallbackId = ids.find((id) => $(id)?.value.trim());
  return fallbackId ? $(fallbackId).value.trim() : '';
}

function configuredForSupabase() {
  const config = window.TRAVEL_APP_CONFIG || {};
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
}

function configuredForAmap() {
  const config = window.TRAVEL_APP_CONFIG || {};
  return Boolean(config.amapKey);
}

function canCreateTrips() {
  if (app.mode === 'demo') return true;
  return window.TRAVEL_APP_CONFIG?.allowTripCreation !== false;
}

function formatDateRange(start, end) {
  if (!start && !end) return '待定';
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function amapSearchErrorMessage(message) {
  const normalized = String(message || '').trim();
  const config = window.TRAVEL_APP_CONFIG || {};
  const hints = [];

  if (!config.amapSecurityJsCode) {
    hints.push('web/config.js 里的 amapSecurityJsCode 还是空的');
  }
  hints.push('确认高德 Web 端应用的域名白名单包含 localhost');
  hints.push('确认 Key 属于 Web端 JS API 应用');

  return `${normalized || '高德服务返回 error'}。请检查：${hints.join('；')}。`;
}

function loadAmapScript() {
  if (window.AMap) return Promise.resolve();

  const config = window.TRAVEL_APP_CONFIG || {};
  if (!config.amapKey) {
    return Promise.reject(new Error('AMAP_KEY_MISSING'));
  }

  if (config.amapSecurityJsCode) {
    window._AMapSecurityConfig = {
      securityJsCode: config.amapSecurityJsCode
    };
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.amapKey)}&plugin=AMap.PlaceSearch,AMap.AutoComplete`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('AMAP_LOAD_FAILED'));
    document.head.appendChild(script);
  });
}

function loadAmapRoutePlugins() {
  if (!window.AMap) return Promise.reject(new Error('AMAP_NOT_READY'));
  return new Promise((resolve) => {
    AMap.plugin(['AMap.Walking', 'AMap.Driving'], resolve);
  });
}

function latLngToAmap(value) {
  return [value[1], value[0]];
}

function storageKey() {
  const tripId = new URLSearchParams(window.location.search).get('trip') || 'demo-trip';
  return `travel-map:${tripId}`;
}

function currentTripIdFromUrl() {
  return new URLSearchParams(window.location.search).get('trip');
}

function setUrlTrip(tripId) {
  const url = new URL(window.location.href);
  url.searchParams.set('trip', tripId);
  window.history.replaceState({}, '', url);
  localStorage.setItem('travel-map:last-trip-id', tripId);
}

function clearUrlTrip() {
  const url = new URL(window.location.href);
  url.searchParams.delete('trip');
  window.history.replaceState({}, '', url);
  localStorage.removeItem('travel-map:last-trip-id');
}

function currentUserId() {
  return app.user?.id || 'local-user';
}

function displayNameFromUser() {
  const email = app.user?.email || '';
  return email ? email.split('@')[0] : '我';
}

function usernameFromUser() {
  const email = app.user?.email || '';
  return email ? email.split('@')[0] : '用户';
}

function randomInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function memberById(userId) {
  return app.state.members.find((member) => member.userId === userId) || {
    userId,
    name: '朋友',
    color: '#64748B',
    role: 'member'
  };
}

function wantsForPlace(placeId) {
  return app.state.wants.filter((want) => want.placeId === placeId).length;
}

function commentsForPlace(placeId) {
  return app.state.comments.filter((comment) => comment.placeId === placeId);
}

function requireTrip() {
  if (app.state.trip) return true;
  alert('请先创建房间，或输入朋友发来的邀请码加入。');
  return false;
}

function requireAuth() {
  if (app.mode === 'demo' || app.user) return true;
  $('authModal').showModal();
  return false;
}

function saveLocal() {
  localStorage.setItem(storageKey(), JSON.stringify(app.state));
}

function loadLocal() {
  const saved = localStorage.getItem(storageKey());
  app.state = saved ? JSON.parse(saved) : structuredClone(demoState);
  saveLocal();
}

function initSupabase() {
  if (!configuredForSupabase()) {
    app.mode = 'demo';
    return;
  }

  const config = window.TRAVEL_APP_CONFIG;
  app.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  app.mode = 'supabase';
}

async function initAuth() {
  if (app.mode !== 'supabase') return;

  const { data } = await app.supabase.auth.getSession();
  app.session = data.session;
  app.user = data.session?.user || null;

  app.supabase.auth.onAuthStateChange(async (_event, session) => {
    app.session = session;
    app.user = session?.user || null;
    await loadState();
    render();
  });
}

async function loadAdminStatus() {
  if (app.mode !== 'supabase' || !app.user) {
    app.isAdmin = app.mode === 'demo';
    return;
  }

  const { data, error } = await app.supabase.rpc('current_user_is_admin');
  if (error) {
    console.error(error);
    app.isAdmin = false;
    return;
  }

  app.isAdmin = Boolean(data);
}

async function loadJoinedTrips() {
  if (app.mode !== 'supabase' || !app.user) {
    const trip = app.state.trip || demoState.trip;
    app.joinedTrips = app.mode === 'demo' && trip
      ? [{ id: trip.id, name: trip.name, city: trip.city, dateRange: trip.dateRange, inviteCode: trip.inviteCode }]
      : [];
    return;
  }

  const { data, error } = await app.supabase
    .from('trip_members')
    .select('trip_id, trips(id,name,city,date_range,invite_code)')
    .eq('user_id', currentUserId())
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    app.joinedTrips = [];
    return;
  }

  app.joinedTrips = (data || [])
    .map((row) => row.trips)
    .filter(Boolean)
    .map((trip) => ({
      id: trip.id,
      name: trip.name,
      city: trip.city,
      dateRange: trip.date_range || '待定',
      inviteCode: trip.invite_code
    }));
}

async function loadState() {
  if (app.mode !== 'supabase') {
    loadLocal();
    await loadAdminStatus();
    await loadJoinedTrips();
    return;
  }

  if (!app.user) {
    app.state = structuredClone(emptyState);
    app.joinedTrips = [];
    app.isAdmin = false;
    return;
  }

  await loadAdminStatus();
  await loadJoinedTrips();

  const tripId = currentTripIdFromUrl();
  if (!tripId) {
    app.state = structuredClone(emptyState);
    return;
  }

  const { data: trip, error: tripError } = await app.supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) {
    console.error(tripError);
    alert('读取房间失败，可能还不是这个房间的成员。');
    app.state = structuredClone(emptyState);
    return;
  }

  if (!trip) {
    app.state = structuredClone(emptyState);
    return;
  }

  const [
    { data: members, error: membersError },
    { data: places, error: placesError },
    { data: wants, error: wantsError },
    { data: comments, error: commentsError },
    { data: routes, error: routesError }
  ] = await Promise.all([
    app.supabase.from('trip_members').select('*').eq('trip_id', trip.id).order('created_at'),
    app.supabase.from('places').select('*').eq('trip_id', trip.id).order('created_at'),
    app.supabase.from('place_wants').select('place_id,user_id,places!inner(trip_id)').eq('places.trip_id', trip.id),
    app.supabase.from('comments').select('*').eq('trip_id', trip.id).order('created_at'),
    app.supabase.from('route_plans').select('*').eq('trip_id', trip.id).limit(1)
  ]);

  const error = membersError || placesError || wantsError || commentsError || routesError;
  if (error) {
    console.error(error);
    alert('读取房间数据失败。');
    return;
  }

  app.state = {
    trip: {
      id: trip.id,
      name: trip.name,
      city: trip.city,
      dateRange: trip.date_range || '待定',
      center: trip.center || demoState.trip.center,
      inviteCode: trip.invite_code
    },
    members: members.map((member) => ({
      userId: member.user_id,
      name: member.display_name,
      color: member.color,
      role: member.role
    })),
    places: places.map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address || '',
      lat: Number(place.lat),
      lng: Number(place.lng),
      category: place.category,
      note: place.note || '',
      createdBy: place.created_by
    })),
    wants: wants.map((want) => ({ placeId: want.place_id, userId: want.user_id })),
    comments: comments.map((comment) => ({
      id: comment.id,
      placeId: comment.place_id,
      userId: comment.user_id,
      content: comment.content
    })),
    routePlaceIds: routes?.[0]?.place_ids || []
  };

  setUrlTrip(trip.id);
}

function passwordCredentials() {
  const username = valueFromInputs(['usernameInput', 'modalUsernameInput']).toLowerCase();
  const password = valueFromInputs(['passwordInput', 'modalPasswordInput']);
  const domain = window.TRAVEL_APP_CONFIG?.authUsernameDomain || 'travel.local';
  return { email: `${username}@${domain}`, password, username };
}

function requirePasswordCredentials() {
  const { email, password, username } = passwordCredentials();
  if (!username) {
    alert('请输入用户名。');
    return null;
  }
  if (!password || password.length < 6) {
    alert('请输入至少 6 位密码。');
    return null;
  }
  return { email, password };
}

async function signInWithPassword() {
  if (app.mode !== 'supabase') {
    alert('请先在 web/config.js 填 Supabase URL 和 anon key。');
    return;
  }

  const credentials = requirePasswordCredentials();
  if (!credentials) return;

  const { error } = await app.supabase.auth.signInWithPassword(credentials);
  if (error) {
    alert(error.message);
    return;
  }

  $('authModal').close();
  await loadState();
  render();
}

async function signOut(event) {
  event?.preventDefault();
  if ($('authModal').open) $('authModal').close();
  clearUrlTrip();
  app.user = null;
  app.session = null;
  app.isAdmin = false;
  app.state = structuredClone(emptyState);
  render();

  if (app.mode === 'supabase') {
    const { error } = await app.supabase.auth.signOut();
    if (error) alert(error.message);
  }
}

async function createTrip() {
  if (!requireAuth()) return;
  if (!canCreateTrips()) {
    alert('当前配置不允许创建房间，请输入邀请码加入已有房间。');
    return;
  }

  const tripName = valueFromInputs(['lobbyTripNameInput']) || '新的旅行';
  const city = valueFromInputs(['lobbyTripCityInput']) || '旅行';
  const dateRange = formatDateRange($('lobbyTripStartDateInput').value, $('lobbyTripEndDateInput').value);
  const mapCenter = app.map ? app.map.getCenter() : null;
  const center = mapCenter ? [mapCenter.getLat(), mapCenter.getLng()] : demoState.trip.center;

  if (app.mode !== 'supabase') {
    app.state = {
      trip: {
        id: `trip-${Date.now()}`,
        name: tripName,
        city,
        dateRange,
        center,
        inviteCode: randomInviteCode()
      },
      members: [{ userId: 'local-user', name: '我', color: '#0F766E', role: 'owner' }],
      places: [],
      wants: [],
      comments: [],
      routePlaceIds: []
    };
    setUrlTrip(app.state.trip.id);
    await loadJoinedTrips();
    saveLocal();
    render();
    return;
  }

  const { data: tripId, error } = await app.supabase.rpc('create_trip_room', {
    p_name: tripName,
    p_city: city,
    p_date_range: dateRange,
    p_center: center,
    p_invite_code: randomInviteCode()
  });

  if (error) {
    alert(error.message);
    return;
  }

  setUrlTrip(tripId);
  await loadState();
  render();
}

async function joinTripByInvite() {
  if (!requireAuth()) return;

  const inviteCode = valueFromInputs(['lobbyInviteCodeInput']).toUpperCase();
  const displayName = valueFromInputs(['lobbyDisplayNameInput']) || displayNameFromUser();
  if (!inviteCode) {
    alert('请输入邀请码。');
    return;
  }

  if (app.mode !== 'supabase') {
    alert('本地演示模式不能真实加入房间，请配置 Supabase。');
    return;
  }

  const { data: tripId, error } = await app.supabase.rpc('join_trip_by_invite', {
    p_invite_code: inviteCode,
    p_display_name: displayName
  });

  if (error) {
    alert(error.message);
    return;
  }

  setUrlTrip(tripId);
  await loadState();
  render();
}

async function persistRoute(options = {}) {
  if (!requireTrip()) return;
  const { reload = false, silent = false } = options;

  if (app.mode !== 'supabase') {
    saveLocal();
    return;
  }

  const { error } = await app.supabase.from('route_plans').upsert({
    trip_id: app.state.trip.id,
    name: '默认路线',
    place_ids: app.state.routePlaceIds,
    updated_by: currentUserId()
  }, { onConflict: 'trip_id' });

  if (error) {
    if (!silent) alert(error.message);
    return;
  }

  if (reload) await loadState();
}

function setPlaceDraft(place) {
  app.placeDraft = place;
  $('placeNameInput').value = place?.name || '';
  $('placeAddressInput').value = place?.address || '';
}

function renderPlaceSearchResults(results = []) {
  const root = $('placeSearchResults');
  root.innerHTML = '';

  if (!results.length) {
    root.innerHTML = '<div class="empty compact">没有找到地点，换个关键词试试</div>';
    return;
  }

  results.forEach((place) => {
    const button = document.createElement('button');
    const active = app.placeDraft && app.placeDraft.lat === place.lat && app.placeDraft.lng === place.lng;
    button.className = `place-result ${active ? 'active' : ''}`;
    button.type = 'button';
    button.innerHTML = `<strong>${place.name}</strong><span>${place.address || '暂无详细地址'}</span>`;
    button.addEventListener('click', () => {
      setPlaceDraft(place);
      renderPlaceSearchResults(results);
      if (app.map) app.map.setZoomAndCenter(16, [place.lng, place.lat]);
    });
    root.appendChild(button);
  });
}

function normalizePoi(poi) {
  if (!poi?.location) return null;
  const lng = typeof poi.location.getLng === 'function' ? poi.location.getLng() : poi.location.lng;
  const lat = typeof poi.location.getLat === 'function' ? poi.location.getLat() : poi.location.lat;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;

  return {
    name: poi.name || '未命名地点',
    address: [poi.district, poi.address].filter(Boolean).join(' ') || poi.address || poi.district || '',
    lat: Number(lat),
    lng: Number(lng)
  };
}

async function ensurePlaceSearch() {
  if (app.placeSearch && app.autoComplete) return { placeSearch: app.placeSearch, autoComplete: app.autoComplete };
  if (!configuredForAmap()) {
    alert('请先在 web/config.js 配置高德地图 Key，才能搜索地点。');
    return null;
  }

  await loadAmapScript();
  return new Promise((resolve) => {
    AMap.plugin(['AMap.PlaceSearch', 'AMap.AutoComplete'], () => {
      app.placeSearch = new AMap.PlaceSearch({
        city: app.state.trip?.city || '全国',
        citylimit: false,
        extensions: 'all',
        pageSize: 8,
        pageIndex: 1
      });
      app.autoComplete = new AMap.AutoComplete({
        city: app.state.trip?.city || '全国',
        citylimit: false
      });
      resolve({ placeSearch: app.placeSearch, autoComplete: app.autoComplete });
    });
  });
}

async function searchPlace() {
  if (!requireTrip()) return;
  const keyword = $('placeSearchInput').value.trim();
  if (!keyword) {
    alert('请输入要搜索的地点名称。');
    return;
  }

  const result = await runPlaceSearch(keyword, $('placeSearchResults'));
  if (!result.ok) {
    $('placeSearchResults').innerHTML = `<div class="empty compact">搜索失败：${amapSearchErrorMessage(result.message)}</div>`;
    return;
  }

  renderPlaceSearchResults(result.places);
}

async function runPlaceSearch(keyword, loadingRoot) {
  const searchers = await ensurePlaceSearch();
  if (!searchers) return { ok: false, places: [], message: '高德地点搜索服务不可用' };
  const { placeSearch, autoComplete } = searchers;

  loadingRoot.innerHTML = '<div class="empty compact">正在搜索...</div>';
  const city = app.state.trip?.city || '全国';

  const searchOnce = (targetCity) => new Promise((resolve) => {
    placeSearch.setCity(targetCity);
    placeSearch.search(keyword, (status, result) => {
      const places = status === 'complete'
        ? (result.poiList?.pois || []).map(normalizePoi).filter(Boolean)
        : [];
      resolve({
        ok: status === 'complete',
        places,
        status,
        info: result?.info || result?.message || ''
      });
    });
  });

  let result = await searchOnce(city);
  if (result.ok && result.places.length) {
    return { ok: true, places: result.places, message: '' };
  }

  if (city !== '全国') {
    result = await searchOnce('全国');
    if (result.ok) {
      return { ok: true, places: result.places, message: '' };
    }
  }

  const autoOnce = (targetCity) => new Promise((resolve) => {
    if (autoComplete.setCity) autoComplete.setCity(targetCity);
    autoComplete.search(keyword, (status, autoResult) => {
      const tips = status === 'complete' ? (autoResult.tips || []) : [];
      const places = tips
        .map((tip) => {
          if (!tip.location) return null;
          const lng = typeof tip.location.getLng === 'function' ? tip.location.getLng() : tip.location.lng;
          const lat = typeof tip.location.getLat === 'function' ? tip.location.getLat() : tip.location.lat;
          if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
          return {
            name: tip.name || '未命名地点',
            address: [tip.district, tip.address].filter(Boolean).join(' ') || tip.district || '',
            lat: Number(lat),
            lng: Number(lng)
          };
        })
        .filter(Boolean);
      resolve({
        ok: status === 'complete',
        places,
        status,
        info: autoResult?.info || autoResult?.message || ''
      });
    });
  });

  let autoResult = await autoOnce(city);
  if (autoResult.ok && autoResult.places.length) {
    return { ok: true, places: autoResult.places, message: '' };
  }

  if (city !== '全国') {
    autoResult = await autoOnce('全国');
    if (autoResult.ok && autoResult.places.length) {
      return { ok: true, places: autoResult.places, message: '' };
    }
  }

  const detail = [result.status, result.info, autoResult?.status, autoResult?.info].filter(Boolean).join(' / ');
  return {
    ok: result.ok || autoResult?.ok || false,
    places: [],
    message: detail || '没有返回结果'
  };
}

function renderMapSearchResults(results = []) {
  const root = $('mapSearchResults');
  root.hidden = false;
  root.innerHTML = '';

  if (!results.length) {
    root.innerHTML = '<div class="empty compact">没有找到地点</div>';
    return;
  }

  results.forEach((place) => {
    const item = document.createElement('article');
    item.className = 'place-result result-with-action';
    item.innerHTML = `
      <button class="result-main" type="button">
        <strong>${place.name}</strong>
        <span>${place.address || '暂无详细地址'}</span>
      </button>
      <button class="small-primary result-add" type="button">添加</button>
    `;
    item.querySelector('.result-main').addEventListener('click', () => {
      if (app.map) app.map.setZoomAndCenter(16, [place.lng, place.lat]);
    });
    item.querySelector('.result-add').addEventListener('click', async () => {
      const saved = await persistPlace({
        ...place,
        category: '景点',
        note: ''
      });
      if (saved) {
        $('mapSearchInput').value = '';
        root.hidden = true;
        root.innerHTML = '';
      }
    });
    root.appendChild(item);
  });
}

function clearSearchResults(rootId, message, hide = false) {
  const root = $(rootId);
  root.hidden = hide;
  root.innerHTML = message ? `<div class="empty compact">${message}</div>` : '';
}

function bindLivePlaceSuggest(inputId, rootId, renderResults, options = {}) {
  let timer = null;
  $(inputId).addEventListener('input', () => {
    window.clearTimeout(timer);
    const keyword = $(inputId).value.trim();

    if (!keyword) {
      clearSearchResults(rootId, options.emptyMessage || '', Boolean(options.hideWhenEmpty));
      return;
    }

    if (keyword.length < 2) {
      clearSearchResults(rootId, '继续输入以显示推荐地点', false);
      return;
    }

    timer = window.setTimeout(async () => {
      if (!requireTrip()) return;
      $(rootId).hidden = false;
      const result = await runPlaceSearch(keyword, $(rootId));
      if (!result.ok) {
        $(rootId).innerHTML = `<div class="empty compact">搜索失败：${amapSearchErrorMessage(result.message)}</div>`;
        return;
      }
      renderResults(result.places);
    }, 350);
  });
}

async function searchMapPlace() {
  if (!requireAuth() || !requireTrip()) return;
  const keyword = $('mapSearchInput').value.trim();
  if (!keyword) {
    $('mapSearchResults').hidden = false;
    $('mapSearchResults').innerHTML = '<div class="empty compact">请输入地点关键词</div>';
    return;
  }

  $('mapSearchResults').hidden = false;
  const result = await runPlaceSearch(keyword, $('mapSearchResults'));
  if (!result.ok) {
    $('mapSearchResults').innerHTML = `<div class="empty compact">搜索失败：${amapSearchErrorMessage(result.message)}</div>`;
    return;
  }
  renderMapSearchResults(result.places);
}

async function persistPlace(place) {
  if (!place.name || Number.isNaN(place.lat) || Number.isNaN(place.lng)) {
    alert('请先搜索并选择一个地点。');
    return false;
  }

  if (app.mode !== 'supabase') {
    const id = `place-${Date.now()}`;
    app.state.places.push({ id, ...place, createdBy: 'local-user' });
    app.state.wants.push({ placeId: id, userId: 'local-user' });
    saveLocal();
  } else {
    const { data: created, error } = await app.supabase
      .from('places')
      .insert({
        trip_id: app.state.trip.id,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        category: place.category,
        note: place.note,
        created_by: currentUserId()
      })
      .select('*')
      .single();

    if (error) {
      alert(error.message);
      return false;
    }

    const { error: wantError } = await app.supabase.from('place_wants').insert({
      place_id: created.id,
      user_id: currentUserId()
    });
    if (wantError) alert(wantError.message);

    app.state.places.push({
      id: created.id,
      name: created.name,
      address: created.address || '',
      lat: Number(created.lat),
      lng: Number(created.lng),
      category: created.category,
      note: created.note || '',
      createdBy: created.created_by
    });
    if (!wantError) app.state.wants.push({ placeId: created.id, userId: currentUserId() });
  }

  renderPlaces();
  renderStats();
  renderMap();
  if (app.map) {
    app.map.setZoomAndCenter(15, [place.lng, place.lat]);
  }
  return true;
}

async function deletePlace(placeId) {
  if (!requireAuth() || !requireTrip()) return;
  const place = app.state.places.find((item) => item.id === placeId);
  if (!place) return;
  if (!confirm(`删除「${place.name}」？相关想去和评论也会一起删除。`)) return;

  const previousState = {
    places: [...app.state.places],
    wants: [...app.state.wants],
    comments: [...app.state.comments],
    routePlaceIds: [...app.state.routePlaceIds],
    selectedPlaceId: app.selectedPlaceId
  };
  const routeChanged = app.state.routePlaceIds.includes(placeId);
  app.state.routePlaceIds = app.state.routePlaceIds.filter((id) => id !== placeId);
  app.state.places = app.state.places.filter((item) => item.id !== placeId);
  app.state.wants = app.state.wants.filter((want) => want.placeId !== placeId);
  app.state.comments = app.state.comments.filter((comment) => comment.placeId !== placeId);
  if (app.selectedPlaceId === placeId) app.selectedPlaceId = null;

  renderPlaces();
  renderStats();
  renderRoute();
  renderMap();

  if (app.mode !== 'supabase') {
    saveLocal();
  } else {
    let query = app.supabase
      .from('places')
      .delete()
      .eq('id', placeId);

    if (!app.isAdmin) query = query.eq('created_by', currentUserId());

    const { error } = await query;

    if (error) {
      app.state.places = previousState.places;
      app.state.wants = previousState.wants;
      app.state.comments = previousState.comments;
      app.state.routePlaceIds = previousState.routePlaceIds;
      app.selectedPlaceId = previousState.selectedPlaceId;
      renderPlaces();
      renderStats();
      renderRoute();
      renderMap();
      alert(error.message);
      return;
    }

    if (routeChanged) await persistRoute({ silent: true });
  }
}

async function savePlace() {
  if (!requireAuth() || !requireTrip()) return;
  const draft = app.placeDraft;

  const place = {
    name: draft?.name || $('placeNameInput').value.trim(),
    address: draft?.address || $('placeAddressInput').value.trim() || '地图选点',
    lat: Number(draft?.lat),
    lng: Number(draft?.lng),
    category: $('placeCategoryInput').value,
    note: $('placeNoteInput').value.trim()
  };

  const saved = await persistPlace(place);
  if (saved) $('placeModal').close();
}

async function toggleWant() {
  if (!requireAuth()) return;

  const placeId = app.selectedPlaceId;
  if (!placeId) return;
  const existing = app.state.wants.find((want) => want.placeId === placeId && want.userId === currentUserId());

  if (app.mode !== 'supabase') {
    if (!existing) app.state.wants.push({ placeId, userId: currentUserId() });
    saveLocal();
  } else if (!existing) {
    const { error } = await app.supabase.from('place_wants').insert({
      place_id: placeId,
      user_id: currentUserId()
    });
    if (error) {
      alert(error.message);
      return;
    }
    app.state.wants.push({ placeId, userId: currentUserId() });
  }

  renderPlaces();
  renderStats();
  renderDetail();
}

async function addComment() {
  if (!requireAuth()) return;

  const content = $('commentInput').value.trim();
  if (!content || !app.selectedPlaceId) return;

  if (app.mode !== 'supabase') {
    app.state.comments.push({
      id: `comment-${Date.now()}`,
      placeId: app.selectedPlaceId,
      userId: currentUserId(),
      content
    });
    saveLocal();
  } else {
    const { data: created, error } = await app.supabase.from('comments').insert({
      trip_id: app.state.trip.id,
      place_id: app.selectedPlaceId,
      user_id: currentUserId(),
      content
    }).select('id')
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    app.state.comments.push({
      id: created?.id || `comment-${Date.now()}`,
      placeId: app.selectedPlaceId,
      userId: currentUserId(),
      content
    });
  }

  $('commentInput').value = '';
  renderPlaces();
  renderDetail();
}

function distanceKm(a, b) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function routeStats(routePlaces) {
  let total = 0;
  for (let i = 1; i < routePlaces.length; i += 1) total += distanceKm(routePlaces[i - 1], routePlaces[i]);
  const minutes = Math.round((total / 18) * 60);
  return {
    distance: total < 1 ? `${Math.round(total * 1000)} m` : `${total.toFixed(1)} km`,
    duration: minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
  };
}

function formatRouteMetric(distanceMeters, durationSeconds) {
  const distance = distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(1)} km`;
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  const duration = minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
  return { distance, duration };
}

function filteredPlaces() {
  return app.state.places.filter((place) => {
    const memberOk = app.filters.member === 'all' || place.createdBy === app.filters.member;
    const categoryOk = app.filters.category === '全部' || place.category === app.filters.category;
    return memberOk && categoryOk;
  });
}

function routePlaces() {
  return app.state.routePlaceIds
    .map((id) => app.state.places.find((place) => place.id === id))
    .filter(Boolean);
}

async function initMap() {
  if (!configuredForAmap()) {
    $('map').innerHTML = '<div class="map-message"><strong>需要配置高德地图 Key</strong><span>打开 web/config.js，填写 amapKey 后刷新页面。</span></div>';
    return;
  }

  try {
    await loadAmapScript();
  } catch (error) {
    console.error(error);
    $('map').innerHTML = '<div class="map-message"><strong>高德地图加载失败</strong><span>请检查 amapKey、域名白名单和网络。</span></div>';
    return;
  }

  const center = app.state.trip?.center || demoState.trip.center;
  app.map = new AMap.Map('map', {
    zoom: 13,
    center: latLngToAmap(center),
    resizeEnable: true,
    viewMode: '2D'
  });

  app.map.on('click', (event) => {
    if (!requireAuth() || !requireTrip()) return;
    resetPlaceForm();
    setPlaceDraft({
      name: '地图选点',
      address: '点击地图添加的位置',
      lat: event.lnglat.getLat(),
      lng: event.lnglat.getLng()
    });
    $('placeSearchResults').innerHTML = '<div class="empty compact">已选中地图上的位置，可以直接保存</div>';
    $('placeModalTitle').textContent = '添加地图选点';
    $('placeModal').showModal();
  });
}

function markerContent(place) {
  const member = memberById(place.createdBy);
  const initial = member.name.slice(0, 1);
  return `<div class="marker-pin" style="background:${member.color}"><span>${initial}</span></div>`;
}

function renderMap() {
  if (!app.map) return;
  app.markers.forEach((marker) => app.map.remove(marker));
  app.markers.clear();
  filteredPlaces().forEach((place) => {
    const marker = new AMap.Marker({
      position: [place.lng, place.lat],
      title: place.name,
      content: markerContent(place),
      offset: new AMap.Pixel(-17, -32),
      anchor: 'bottom-center'
    });
    marker.on('click', () => openDetail(place.id));
    app.map.add(marker);
    app.markers.set(place.id, marker);
  });
  renderRouteLine();
}

function removeRouteLine() {
  if (!app.map) return;
  if (Array.isArray(app.routeLine)) {
    app.routeLine.forEach((line) => app.map.remove(line));
  } else if (app.routeLine) {
    app.map.remove(app.routeLine);
  }
  app.routeLine = null;
}

function drawRoutePolyline(paths, dashed = false) {
  if (!app.map || paths.length < 2) return null;
  const line = new AMap.Polyline({
    path: paths,
    strokeColor: dashed ? '#64748b' : '#0f766e',
    strokeWeight: dashed ? 4 : 5,
    strokeOpacity: dashed ? 0.48 : 0.82,
    strokeStyle: dashed ? 'dashed' : 'solid',
    lineJoin: 'round',
    lineCap: 'round'
  });
  app.map.add(line);
  return line;
}

function routeKey(places = routePlaces()) {
  return `${app.routeMode}:${places.map((place) => place.id).join('|')}`;
}

function amapPointToArray(point) {
  if (Array.isArray(point)) return point;
  if (typeof point.getLng === 'function') return [point.getLng(), point.getLat()];
  return [point.lng, point.lat];
}

function searchRouteSegment(service, start, end) {
  return new Promise((resolve, reject) => {
    const callback = (status, result) => {
      if (status !== 'complete' || !result?.routes?.length) {
        reject(new Error(result?.info || status || 'ROUTE_SEARCH_FAILED'));
        return;
      }

      const route = result.routes[0];
      const path = [];
      route.steps?.forEach((step) => {
        step.path?.forEach((point) => path.push(amapPointToArray(point)));
      });
      resolve({
        path: path.length ? path : [[start.lng, start.lat], [end.lng, end.lat]],
        distance: Number(route.distance || 0),
        duration: Number(route.time || 0)
      });
    };

    if (app.routeMode === 'driving') {
      service.search([start.lng, start.lat], [end.lng, end.lat], {}, callback);
    } else {
      service.search([start.lng, start.lat], [end.lng, end.lat], callback);
    }
  });
}

async function calculateAmapRoute(places, token) {
  try {
    await loadAmapRoutePlugins();
    const Service = app.routeMode === 'driving' ? AMap.Driving : AMap.Walking;
    const service = new Service({ hideMarkers: true });
    const segments = [];

    for (let i = 1; i < places.length; i += 1) {
      segments.push(await searchRouteSegment(service, places[i - 1], places[i]));
      if (token !== app.routeSearchToken) return;
    }

    if (token !== app.routeSearchToken) return;
    removeRouteLine();
    const lines = segments
      .map((segment) => drawRoutePolyline(segment.path))
      .filter(Boolean);
    app.routeLine = lines;

    app.routeMetric = {
      key: routeKey(places),
      distanceMeters: segments.reduce((sum, item) => sum + item.distance, 0),
      durationSeconds: segments.reduce((sum, item) => sum + item.duration, 0),
      status: 'ready'
    };
  } catch (error) {
    console.warn(error);
    app.routeMetric = {
      key: routeKey(places),
      status: 'fallback'
    };
  }

  if (token === app.routeSearchToken) renderRouteSummary();
}

function renderRouteLine() {
  if (!app.map) return;
  app.routeSearchToken += 1;
  const token = app.routeSearchToken;
  const places = routePlaces();
  const points = places.map((place) => [place.lng, place.lat]);
  removeRouteLine();

  if (points.length < 2) {
    app.routeMetric = null;
    renderRouteSummary();
    return;
  }

  app.routeMetric = { key: routeKey(places), status: 'loading' };
  renderRouteSummary();
  app.routeLine = drawRoutePolyline(points, true);
  calculateAmapRoute(places, token);
}

function fitMap() {
  if (!app.map) return;
  const places = filteredPlaces();
  if (!places.length) {
    app.map.setZoomAndCenter(13, latLngToAmap(app.state.trip?.center || demoState.trip.center));
    return;
  }
  const overlays = Array.from(app.markers.values());
  if (Array.isArray(app.routeLine)) {
    overlays.push(...app.routeLine);
  } else if (app.routeLine) {
    overlays.push(app.routeLine);
  }
  if (overlays.length) app.map.setFitView(overlays, false, [80, 80, 80, 80], 15);
}

async function ensureMap() {
  if (app.map || app.mapInitPromise || !app.state.trip) return app.mapInitPromise;

  app.mapInitPromise = initMap()
    .then(() => {
      renderMap();
      fitMap();
    })
    .finally(() => {
      app.mapInitPromise = null;
    });

  return app.mapInitPromise;
}

function renderView() {
  const needsLogin = app.mode === 'supabase' && !app.user;
  const needsLobby = !needsLogin && app.mode === 'supabase' && !app.state.trip;
  const needsRoom = !needsLogin && !needsLobby;

  $('loginView').hidden = !needsLogin;
  $('lobbyView').hidden = !needsLobby;
  $('roomView').hidden = !needsRoom;

  if (needsRoom) {
    ensureMap();
    if (!app.roomWasVisible) {
      window.setTimeout(() => {
        if (app.map?.resize) app.map.resize();
      }, 0);
    }
  }
  app.roomWasVisible = needsRoom;
}

function renderAuth() {
  const configured = app.mode === 'supabase';
  $('authStatus').textContent = configured ? (app.user ? `已登录：${usernameFromUser()}` : '未登录') : '本地演示模式';
  $('openAuth').textContent = app.user ? '账户' : '登录';
  $('signOut').hidden = !app.user;
  $('authSubtitle').hidden = configured;
  $('authHint').textContent = configured ? '使用管理员维护的用户名和密码登录。' : '填好 Supabase 配置后才会启用真实登录。';
  $('loginHint').textContent = configured ? '请输入管理员分配的用户名和密码。' : '当前是本地演示模式；配置 Supabase 后会启用真实登录。';
  $('lobbyAuthStatus').textContent = app.user ? `已登录：${usernameFromUser()}` : '已进入本地演示';
}

function renderLobby() {
  const allowed = canCreateTrips();
  $('lobbyCreateTrip').disabled = !allowed;
  $('lobbyCreatePanel').classList.toggle('disabled-panel', !allowed);
  $('createTripPermissionHint').hidden = allowed;

  if (!$('lobbyTripStartDateInput').value) {
    const today = new Date();
    $('lobbyTripStartDateInput').valueAsDate = today;
    const end = new Date(today);
    end.setDate(today.getDate() + 2);
    $('lobbyTripEndDateInput').valueAsDate = end;
  }

  const root = $('joinedTripList');
  root.innerHTML = '';
  if (!app.joinedTrips.length) {
    root.innerHTML = '<div class="empty compact">还没有加入过房间</div>';
    return;
  }

  app.joinedTrips.forEach((trip) => {
    const button = document.createElement('button');
    button.className = 'joined-trip';
    button.type = 'button';
    button.innerHTML = `
      <strong>${trip.name}</strong>
      <span>${trip.city || '旅行'} · ${trip.dateRange || '待定'}</span>
    `;
    button.addEventListener('click', () => openTrip(trip.id));
    root.appendChild(button);
  });
}

function renderTrip() {
  const trip = app.state.trip;
  $('tripName').textContent = trip?.name || '新的旅行';
  $('tripCity').textContent = trip?.city || '旅行';
  $('tripDate').textContent = trip?.dateRange || '创建房间或输入邀请码加入';
  $('overlayTitle').textContent = trip ? `${trip.city}共享收藏地图` : '共享收藏地图';
}

function renderFilters() {
  const memberRoot = $('memberFilters');
  memberRoot.innerHTML = '';
  [{ userId: 'all', name: '全部', color: '#475569' }, ...app.state.members].forEach((member) => {
    const button = document.createElement('button');
    button.className = `chip ${app.filters.member === member.userId ? 'active' : ''}`;
    button.type = 'button';
    button.innerHTML = `<span class="dot" style="background:${member.color}"></span>${member.name}`;
    button.addEventListener('click', () => {
      app.filters.member = member.userId;
      render();
    });
    memberRoot.appendChild(button);
  });

  const categoryRoot = $('categoryFilters');
  categoryRoot.innerHTML = '';
  CATEGORIES.forEach((category) => {
    const button = document.createElement('button');
    button.className = `chip ${app.filters.category === category ? 'active' : ''}`;
    button.type = 'button';
    button.textContent = category;
    button.addEventListener('click', () => {
      app.filters.category = category;
      render();
    });
    categoryRoot.appendChild(button);
  });
}

function renderPlaces() {
  const root = $('placeList');
  const places = filteredPlaces();
  root.innerHTML = '';
  if (!places.length) {
    root.innerHTML = '<div class="empty">当前筛选下还没有地点</div>';
    return;
  }
  places.forEach((place) => {
    const member = memberById(place.createdBy);
    const card = document.createElement('article');
    card.className = 'place-card';
    const canDelete = app.mode === 'demo' || app.isAdmin || place.createdBy === currentUserId();
    card.innerHTML = `
      <div class="place-card-actions">
        <button class="place-open" type="button">
          查看详情
        </button>
        ${canDelete ? '<button class="place-delete" type="button">删除</button>' : ''}
      </div>
      <button class="place-main" type="button">
        <div class="place-title-row">
          <div>
            <span class="place-name">${place.name}</span>
            <span class="place-address">${place.address}</span>
          </div>
          <span class="owner-pill" style="background:${member.color}">${member.name}</span>
        </div>
        <div class="meta-row">
          <span>${place.category}</span>
          <span>${wantsForPlace(place.id)} 人想去</span>
          <span>${commentsForPlace(place.id).length} 条讨论</span>
        </div>
        <p class="place-note">${place.note || '暂无备注'}</p>
      </button>
    `;
    card.querySelector('.place-main').addEventListener('click', () => openDetail(place.id));
    card.querySelector('.place-open').addEventListener('click', () => openDetail(place.id));
    const deleteButton = card.querySelector('.place-delete');
    if (deleteButton) deleteButton.addEventListener('click', () => deletePlace(place.id));
    root.appendChild(card);
  });
}

function renderStats() {
  $('placeCount').textContent = app.state.places.length;
  $('memberCount').textContent = app.state.members.length;
  $('routeCount').textContent = app.state.routePlaceIds.length;
}

function renderRouteSummary() {
  const places = routePlaces();
  const metric = app.routeMetric?.key === routeKey(places) ? app.routeMetric : null;
  const modeName = app.routeMode === 'driving' ? '驾车' : '走路';

  if (places.length < 2) {
    const stats = routeStats(places);
    $('routeSummary').textContent = `${places.length} 个地点 · ${modeName} · ${stats.distance} · ${stats.duration}`;
    return;
  }

  if (metric?.status === 'ready') {
    const formatted = formatRouteMetric(metric.distanceMeters, metric.durationSeconds);
    $('routeSummary').textContent = `${places.length} 个地点 · ${modeName} · ${formatted.distance} · ${formatted.duration}`;
    return;
  }

  const stats = routeStats(places);
  const suffix = metric?.status === 'loading' ? '计算中' : '直线预估';
  $('routeSummary').textContent = `${places.length} 个地点 · ${modeName}${suffix} · ${stats.distance} · ${stats.duration}`;
}

function renderRoute() {
  const places = routePlaces();
  renderRouteSummary();
  $('routeModeWalking').classList.toggle('active', app.routeMode === 'walking');
  $('routeModeDriving').classList.toggle('active', app.routeMode === 'driving');
  const root = $('routeList');
  root.innerHTML = '';
  if (!places.length) {
    root.innerHTML = '<div class="empty">从地点详情加入路线，或点击全选</div>';
    return;
  }
  places.forEach((place, index) => {
    const item = document.createElement('article');
    item.className = 'route-item';
    item.draggable = true;
    item.innerHTML = `
      <div class="route-title-row">
        <span class="step">${index + 1}</span>
        <div class="route-main">
          <span class="route-name">${place.name}</span>
          <span class="route-address">${place.address}</span>
        </div>
        <div class="route-tools">
          <div class="sort-buttons">
            <button type="button" data-action="up">↑</button>
            <button type="button" data-action="down">↓</button>
          </div>
          <button class="route-remove" type="button" data-action="remove">移除</button>
        </div>
      </div>
    `;
    item.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', String(index)));
    item.addEventListener('dragover', (event) => event.preventDefault());
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      moveRouteItem(Number(event.dataTransfer.getData('text/plain')), index);
    });
    item.querySelector('[data-action="up"]').addEventListener('click', () => moveRouteItem(index, index - 1));
    item.querySelector('[data-action="down"]').addEventListener('click', () => moveRouteItem(index, index + 1));
    item.querySelector('[data-action="remove"]').addEventListener('click', () => removeRouteItem(index));
    root.appendChild(item);
  });
}

function render() {
  renderView();
  renderAuth();
  renderLobby();
  renderTrip();
  renderFilters();
  renderPlaces();
  renderStats();
  renderRoute();
  renderMap();
}

async function moveRouteItem(from, to) {
  if (to < 0 || to >= app.state.routePlaceIds.length || from === to) return;
  const ids = app.state.routePlaceIds;
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  await persistRoute();
  renderStats();
  renderRoute();
  renderRouteLine();
}

async function removeRouteItem(index) {
  if (index < 0 || index >= app.state.routePlaceIds.length) return;
  app.state.routePlaceIds.splice(index, 1);
  await persistRoute();
  renderStats();
  renderRoute();
  renderRouteLine();
}

function openDetail(placeId) {
  app.selectedPlaceId = placeId;
  renderDetail();
  if (!$('detailModal').open) $('detailModal').showModal();
}

function renderDetail() {
  const placeId = app.selectedPlaceId;
  const place = app.state.places.find((item) => item.id === placeId);
  if (!place) return;
  const member = memberById(place.createdBy);
  $('detailName').textContent = place.name;
  $('detailAddress').textContent = place.address;
  $('detailNote').textContent = place.note || '暂无备注';
  $('detailMeta').innerHTML = `<span>${place.category}</span><span>${member.name}收藏</span><span>${wantsForPlace(place.id)} 人想去</span>`;
  const comments = commentsForPlace(place.id);
  $('detailComments').innerHTML = comments.length
    ? comments.map((comment) => `<div class="comment"><strong>${memberById(comment.userId).name}</strong><span>${comment.content}</span></div>`).join('')
    : '<div class="empty">还没有讨论</div>';
  const routeButton = $('detailAddRoute');
  const alreadyInRoute = app.state.routePlaceIds.includes(place.id);
  routeButton.textContent = alreadyInRoute ? '已加入路线' : '加入路线';
  routeButton.disabled = alreadyInRoute;
  $('commentInput').value = '';
}

function resetPlaceForm() {
  $('placeModalTitle').textContent = '添加地点';
  app.placeDraft = null;
  $('placeSearchInput').value = '';
  $('placeSearchResults').innerHTML = '<div class="empty compact">搜索并选择一个地点后再保存</div>';
  $('placeNameInput').value = '';
  $('placeAddressInput').value = '';
  $('placeCategoryInput').value = '景点';
  $('placeNoteInput').value = '';
}

function setRouteMode(mode) {
  if (!['walking', 'driving'].includes(mode) || app.routeMode === mode) return;
  app.routeMode = mode;
  app.routeMetric = null;
  renderRoute();
  renderRouteLine();
}

function openNavigation(place) {
  const route = routePlaces();
  const target = place || route[route.length - 1] || route[0];
  if (!target) return;
  const mode = app.routeMode === 'driving' ? 'car' : 'walk';
  const start = !place && route.length > 1 ? route[0] : null;
  const params = new URLSearchParams({
    to: `${target.lng},${target.lat},${target.name}`,
    mode,
    policy: '1'
  });
  if (start) params.set('from', `${start.lng},${start.lat},${start.name}`);
  const url = `https://uri.amap.com/navigation?${params.toString()}`;
  window.open(url, '_blank', 'noopener');
}

async function copyInvite() {
  if (!app.state.trip) return;
  const text = `邀请码：${app.state.trip.inviteCode}\n链接：${window.location.origin}${window.location.pathname}?trip=${app.state.trip.id}`;
  try {
    await navigator.clipboard.writeText(text);
    alert('邀请码和链接已复制。');
  } catch (_error) {
    prompt('复制邀请码和链接给朋友', text);
  }
}

async function openTrip(tripId) {
  setUrlTrip(tripId);
  await loadState();
  render();
  fitMap();
}

function bindEvents() {
  $('openAuth').addEventListener('click', () => $('authModal').showModal());
  $('passwordSignIn').addEventListener('click', signInWithPassword);
  $('modalPasswordSignIn').addEventListener('click', signInWithPassword);
  $('signOut').addEventListener('click', signOut);
  $('lobbySignOut').addEventListener('click', signOut);
  $('lobbyCreateTrip').addEventListener('click', createTrip);
  $('lobbyJoinTrip').addEventListener('click', joinTripByInvite);
  $('copyShareLink').addEventListener('click', copyInvite);
  $('searchPlace').addEventListener('click', searchPlace);
  $('placeSearchInput').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    searchPlace();
  });
  bindLivePlaceSuggest('placeSearchInput', 'placeSearchResults', renderPlaceSearchResults, {
    emptyMessage: '搜索并选择一个地点后再保存'
  });
  $('mapSearchButton').addEventListener('click', searchMapPlace);
  $('mapSearchInput').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    searchMapPlace();
  });
  bindLivePlaceSuggest('mapSearchInput', 'mapSearchResults', renderMapSearchResults, {
    hideWhenEmpty: true
  });
  $('openAddPlace').addEventListener('click', () => {
    if (!requireAuth() || !requireTrip()) return;
    resetPlaceForm();
    $('placeModal').showModal();
  });
  $('savePlace').addEventListener('click', savePlace);
  $('fitMap').addEventListener('click', fitMap);
  $('selectAllPlaces').addEventListener('click', async () => {
    if (!requireTrip()) return;
    app.state.routePlaceIds = app.state.places.map((place) => place.id);
    await persistRoute();
    renderStats();
    renderRoute();
    renderRouteLine();
  });
  $('clearRoute').addEventListener('click', async () => {
    app.state.routePlaceIds = [];
    await persistRoute();
    renderStats();
    renderRoute();
    renderRouteLine();
  });
  $('routeModeWalking').addEventListener('click', () => setRouteMode('walking'));
  $('routeModeDriving').addEventListener('click', () => setRouteMode('driving'));
  $('openNavigation').addEventListener('click', () => openNavigation());
  $('detailWant').addEventListener('click', toggleWant);
  $('detailAddRoute').addEventListener('click', async () => {
    if (!app.selectedPlaceId || app.state.routePlaceIds.includes(app.selectedPlaceId)) return;
    app.state.routePlaceIds.push(app.selectedPlaceId);
    await persistRoute();
    renderStats();
    renderRoute();
    renderRouteLine();
    renderDetail();
  });
  $('detailNavigate').addEventListener('click', () => {
    const place = app.state.places.find((item) => item.id === app.selectedPlaceId);
    openNavigation(place);
  });
  $('addComment').addEventListener('click', addComment);
}

async function boot() {
  initSupabase();
  await initAuth();
  await loadState();
  bindEvents();
  render();
}

boot();
