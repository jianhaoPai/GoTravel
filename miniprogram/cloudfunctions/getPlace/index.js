const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const memberRes = await db.collection('members')
    .where({ tripId: event.tripId, openid: wxContext.OPENID })
    .limit(1)
    .get();

  if (!memberRes.data.length) {
    throw new Error('FORBIDDEN_NOT_TRIP_MEMBER');
  }

  const place = (await db.collection('places').doc(event.placeId).get()).data;
  const [membersRes, commentsRes] = await Promise.all([
    db.collection('members').where({ tripId: event.tripId }).get(),
    db.collection('comments').where({ placeId: event.placeId }).get()
  ]);
  const members = membersRes.data;

  function memberByOpenid(openid) {
    return members.find((item) => item.openid === openid) || {};
  }

  const creator = memberByOpenid(place.createdBy);
  const comments = commentsRes.data.map((comment) => {
    const member = memberByOpenid(comment.createdBy);

    return Object.assign({}, comment, {
      creatorName: member.nickName || '朋友',
      creatorInitial: (member.nickName || '朋').slice(0, 1),
      creatorColor: member.avatarColor || '#64748B'
    });
  });

  return {
    place: Object.assign({}, place, {
      creatorName: creator.nickName || '朋友',
      creatorColor: creator.avatarColor || '#64748B'
    }),
    comments
  };
};
