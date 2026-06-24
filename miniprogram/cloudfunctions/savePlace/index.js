const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

async function assertMember(tripId, openid) {
  const res = await db.collection('members')
    .where({ tripId, openid })
    .limit(1)
    .get();

  if (!res.data.length) {
    throw new Error('FORBIDDEN_NOT_TRIP_MEMBER');
  }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const now = db.serverDate();
  const tripId = event.tripId;

  await assertMember(tripId, wxContext.OPENID);

  const place = {
    tripId,
    name: event.name,
    address: event.address,
    latitude: event.latitude,
    longitude: event.longitude,
    category: event.category || '景点',
    note: event.note || '',
    status: event.status || 'want',
    createdBy: wxContext.OPENID,
    wantCount: event.wantCount || 1,
    commentCount: event.commentCount || 0,
    updatedAt: now
  };

  if (event._id) {
    await db.collection('places').doc(event._id).update({ data: place });
    return { place: Object.assign({ _id: event._id }, place) };
  }

  place.createdAt = now;
  const res = await db.collection('places').add({ data: place });

  return {
    place: Object.assign({ _id: res._id }, place)
  };
};
