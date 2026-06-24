const mock = require('./mockData');
const config = require('../config/env');

const localState = {
  trip: mock.trip,
  members: mock.members.slice(),
  places: mock.places.slice(),
  comments: mock.comments.slice(),
  routePlan: Object.assign({}, mock.routePlan)
};

function activeTripId() {
  const app = typeof getApp === 'function' ? getApp() : null;
  return (app && app.globalData && app.globalData.activeTripId) || localState.trip._id;
}

function hasCloud() {
  return Boolean(config.cloudEnvId && wx.cloud && wx.cloud.callFunction);
}

function callCloud(name, data) {
  if (!hasCloud()) {
    return Promise.reject(new Error('CloudBase is not configured'));
  }

  return wx.cloud.callFunction({ name, data }).then((res) => res.result);
}

function useLocalFallback(error, fallback) {
  if (!config.cloudEnvId && config.useMockDataWhenNoCloud) {
    return fallback();
  }

  if (config.cloudEnvId && config.fallbackToMockOnCloudError) {
    console.warn('[CloudBase fallback]', error);
    return fallback();
  }

  console.error('[CloudBase error]', error);
  wx.showToast({
    title: '云开发调用失败',
    icon: 'none'
  });
  return Promise.reject(error);
}

function memberByOpenid(openid) {
  return localState.members.find((member) => member.openid === openid) || localState.members[0];
}

function enrichPlace(place) {
  const member = memberByOpenid(place.createdBy);

  return Object.assign({}, place, {
    creatorName: member.nickName,
    creatorColor: member.avatarColor
  });
}

function listLocalTripData() {
  return Promise.resolve({
    trip: localState.trip,
    members: localState.members,
    places: localState.places.map(enrichPlace),
    routePlan: localState.routePlan
  });
}

function listTripData(tripId) {
  return callCloud('listTripData', { tripId }).catch((error) => (
    useLocalFallback(error, listLocalTripData)
  ));
}

function getPlace(placeId, tripId) {
  tripId = tripId || activeTripId();
  return callCloud('getPlace', { tripId, placeId }).catch((error) => (
    useLocalFallback(error, () => getLocalPlace(placeId))
  ));
}

function getLocalPlace(placeId) {
  const place = localState.places.find((item) => item._id === placeId);
  const placeComments = localState.comments
    .filter((comment) => comment.placeId === placeId)
    .map((comment) => {
      const member = memberByOpenid(comment.createdBy);
      return Object.assign({}, comment, {
        creatorName: member.nickName,
        creatorInitial: member.nickName.slice(0, 1),
        creatorColor: member.avatarColor
      });
    });

  return Promise.resolve({
    place: enrichPlace(place),
    comments: placeComments
  });
}

function createTrip(payload) {
  return callCloud('createTrip', payload).catch((error) => useLocalFallback(error, () => {
    localState.trip = Object.assign({}, localState.trip, payload, {
      _id: `trip-local-${Date.now()}`
    });
    return { trip: localState.trip };
  }));
}

function joinTrip(tripId, user) {
  return callCloud('joinTrip', { tripId, user }).catch((error) => useLocalFallback(error, () => {
    const exists = localState.members.some((member) => member.openid === user.openid);
    if (!exists) {
      localState.members.push({
        _id: `member-${Date.now()}`,
        tripId,
        openid: user.openid,
        nickName: user.nickName || '朋友',
        avatarColor: user.avatarColor || '#7C3AED',
        role: 'member'
      });
    }
    return { ok: true };
  }));
}

function savePlace(place) {
  const payload = Object.assign({
    tripId: activeTripId()
  }, place);

  return callCloud('savePlace', payload).catch((error) => useLocalFallback(error, () => {
    const saved = Object.assign({
      _id: `place-${Date.now()}`,
      tripId: localState.trip._id,
      createdBy: 'local-user',
      wantCount: 1,
      commentCount: 0
    }, payload);

    const index = localState.places.findIndex((item) => item._id === saved._id);
    if (index >= 0) {
      localState.places.splice(index, 1, saved);
    } else {
      localState.places.push(saved);
    }

    return { place: enrichPlace(saved) };
  }));
}

function toggleReaction(placeId) {
  return callCloud('toggleReaction', { placeId, type: 'want' }).catch((error) => useLocalFallback(error, () => {
    const place = localState.places.find((item) => item._id === placeId);
    if (place) {
      place.wantCount = Math.max(0, (place.wantCount || 0) + 1);
    }
    return { place: enrichPlace(place) };
  }));
}

function saveRoute(tripId, placeIds) {
  return callCloud('saveRoute', { tripId, placeIds }).catch((error) => useLocalFallback(error, () => {
    localState.routePlan = {
      _id: localState.routePlan._id || `route-${Date.now()}`,
      tripId,
      name: '第一天路线',
      placeIds,
      updatedAt: '刚刚'
    };

    return { routePlan: localState.routePlan };
  }));
}

module.exports = {
  createTrip,
  joinTrip,
  listTripData,
  getPlace,
  savePlace,
  toggleReaction,
  saveRoute
};
