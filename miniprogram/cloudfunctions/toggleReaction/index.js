const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const place = (await db.collection('places').doc(event.placeId).get()).data;
  const member = await db.collection('members')
    .where({ tripId: place.tripId, openid: wxContext.OPENID })
    .limit(1)
    .get();

  if (!member.data.length) {
    throw new Error('FORBIDDEN_NOT_TRIP_MEMBER');
  }

  const existing = await db.collection('placeReactions')
    .where({ placeId: event.placeId, openid: wxContext.OPENID, type: 'want' })
    .limit(1)
    .get();

  if (existing.data.length) {
    return { place };
  }

  await db.collection('placeReactions').add({
    data: {
      placeId: event.placeId,
      tripId: place.tripId,
      openid: wxContext.OPENID,
      type: 'want',
      createdAt: db.serverDate()
    }
  });

  await db.collection('places').doc(event.placeId).update({
    data: {
      wantCount: _.inc(1),
      updatedAt: db.serverDate()
    }
  });

  const updated = (await db.collection('places').doc(event.placeId).get()).data;
  return { place: updated };
};
