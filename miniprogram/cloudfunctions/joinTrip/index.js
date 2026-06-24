const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const tripId = event.tripId;
  const existing = await db.collection('members')
    .where({ tripId, openid: wxContext.OPENID })
    .limit(1)
    .get();

  if (existing.data.length) {
    return { ok: true, member: existing.data[0] };
  }

  const user = event.user || {};
  const member = {
    tripId,
    openid: wxContext.OPENID,
    nickName: user.nickName || '朋友',
    avatarColor: user.avatarColor || '#2563EB',
    role: 'member',
    createdAt: db.serverDate()
  };

  const res = await db.collection('members').add({ data: member });

  return {
    ok: true,
    member: Object.assign({ _id: res._id }, member)
  };
};
