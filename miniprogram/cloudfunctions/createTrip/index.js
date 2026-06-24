const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const now = db.serverDate();
  const trip = {
    name: event.name,
    city: event.city,
    dateRange: event.dateRange,
    center: event.center,
    ownerOpenid: wxContext.OPENID,
    createdAt: now,
    updatedAt: now
  };

  const tripRes = await db.collection('trips').add({ data: trip });

  await db.collection('members').add({
    data: {
      tripId: tripRes._id,
      openid: wxContext.OPENID,
      nickName: event.nickName || '我',
      avatarColor: event.avatarColor || '#0F766E',
      role: 'owner',
      createdAt: now
    }
  });

  return {
    trip: Object.assign({ _id: tripRes._id }, trip)
  };
};
