const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function enrichPlace(place, members) {
  const member = members.find((item) => item.openid === place.createdBy) || {};

  return Object.assign({}, place, {
    creatorName: member.nickName || '朋友',
    creatorColor: member.avatarColor || '#64748B'
  });
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const tripId = event.tripId;
  const memberRes = await db.collection('members')
    .where({ tripId, openid: wxContext.OPENID })
    .limit(1)
    .get();

  if (!memberRes.data.length) {
    throw new Error('FORBIDDEN_NOT_TRIP_MEMBER');
  }

  const [tripRes, membersRes, placesRes, routesRes] = await Promise.all([
    db.collection('trips').doc(tripId).get(),
    db.collection('members').where({ tripId }).get(),
    db.collection('places').where({ tripId }).get(),
    db.collection('routePlans').where({ tripId }).limit(1).get()
  ]);

  const members = membersRes.data;

  return {
    trip: tripRes.data,
    members,
    places: placesRes.data.map((place) => enrichPlace(place, members)),
    routePlan: routesRes.data[0] || {
      tripId,
      name: '第一天路线',
      placeIds: []
    }
  };
};
