const trip = {
  _id: 'trip-demo-shanghai',
  name: '上海周末漫游',
  city: '上海',
  dateRange: '6月28日 - 6月30日',
  ownerOpenid: 'local-user',
  center: {
    latitude: 31.2304,
    longitude: 121.4737
  }
};

const members = [
  {
    _id: 'member-me',
    tripId: trip._id,
    openid: 'local-user',
    nickName: '我',
    avatarColor: '#0F766E',
    role: 'owner'
  },
  {
    _id: 'member-chen',
    tripId: trip._id,
    openid: 'friend-chen',
    nickName: '阿辰',
    avatarColor: '#2563EB',
    role: 'member'
  },
  {
    _id: 'member-lin',
    tripId: trip._id,
    openid: 'friend-lin',
    nickName: '林林',
    avatarColor: '#D97706',
    role: 'member'
  }
];

const places = [
  {
    _id: 'place-yuyuan',
    tripId: trip._id,
    name: '豫园',
    address: '上海市黄浦区福佑路168号',
    latitude: 31.2272,
    longitude: 121.4922,
    category: '景点',
    note: '适合下午去，附近可以顺便吃小笼。',
    status: 'want',
    createdBy: 'friend-chen',
    wantCount: 3,
    commentCount: 2
  },
  {
    _id: 'place-bund',
    tripId: trip._id,
    name: '外滩',
    address: '上海市黄浦区中山东一路',
    latitude: 31.2401,
    longitude: 121.4908,
    category: '景点',
    note: '晚上看夜景，拍照位置多。',
    status: 'must',
    createdBy: 'local-user',
    wantCount: 3,
    commentCount: 1
  },
  {
    _id: 'place-wukang',
    tripId: trip._id,
    name: '武康路',
    address: '上海市徐汇区武康路',
    latitude: 31.2094,
    longitude: 121.4443,
    category: '街区',
    note: '咖啡店多，适合慢慢逛。',
    status: 'want',
    createdBy: 'friend-lin',
    wantCount: 2,
    commentCount: 3
  },
  {
    _id: 'place-noodle',
    tripId: trip._id,
    name: '弄堂面馆',
    address: '上海市黄浦区云南南路',
    latitude: 31.2269,
    longitude: 121.4784,
    category: '餐厅',
    note: '早午餐备选，离人民广场近。',
    status: 'maybe',
    createdBy: 'local-user',
    wantCount: 1,
    commentCount: 0
  }
];

const comments = [
  {
    _id: 'comment-1',
    placeId: 'place-yuyuan',
    createdBy: 'friend-lin',
    content: '这里可以和城隍庙一起排。',
    createdAt: '10:12'
  },
  {
    _id: 'comment-2',
    placeId: 'place-yuyuan',
    createdBy: 'local-user',
    content: '我想吃南翔馒头店。',
    createdAt: '10:18'
  },
  {
    _id: 'comment-3',
    placeId: 'place-bund',
    createdBy: 'friend-chen',
    content: '建议放到晚饭后。',
    createdAt: '11:05'
  }
];

const routePlan = {
  _id: 'route-demo',
  tripId: trip._id,
  name: '第一天路线',
  placeIds: ['place-wukang', 'place-noodle', 'place-yuyuan', 'place-bund'],
  updatedAt: '刚刚'
};

module.exports = {
  trip,
  members,
  places,
  comments,
  routePlan
};
