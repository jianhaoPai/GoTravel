const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const tripId = event.tripId;
  const member = await db.collection('members')
    .where({ tripId, openid: wxContext.OPENID })
    .limit(1)
    .get();

  if (!member.data.length) {
    throw new Error('FORBIDDEN_NOT_TRIP_MEMBER');
  }

  const route = {
    tripId,
    name: event.name || '第一天路线',
    placeIds: event.placeIds || [],
    updatedBy: wxContext.OPENID,
    updatedAt: db.serverDate()
  };
  const existing = await db.collection('routePlans').where({ tripId }).limit(1).get();

  if (existing.data.length) {
    await db.collection('routePlans').doc(existing.data[0]._id).update({ data: route });
    return { routePlan: Object.assign({ _id: existing.data[0]._id }, route) };
  }

  route.createdAt = db.serverDate();
  const res = await db.collection('routePlans').add({ data: route });

  return {
    routePlan: Object.assign({ _id: res._id }, route)
  };
};
