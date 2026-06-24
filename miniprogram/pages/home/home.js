const api = require('../../services/api');

const app = getApp();

Page({
  data: {
    trip: {},
    members: [],
    memberFilters: [],
    places: [],
    filteredPlaces: [],
    categories: ['全部', '景点', '餐厅', '街区', '购物'],
    activeMember: 'all',
    activeCategory: '全部',
    routeCount: 0,
    draftTrip: {
      name: '杭州三日游',
      city: '杭州',
      dateRange: '7月12日 - 7月14日'
    }
  },

  onLoad(options) {
    if (options.tripId) {
      app.globalData.activeTripId = options.tripId;
      api.joinTrip(options.tripId, app.globalData.user);
    }
  },

  onShow() {
    this.loadData();
  },

  onShareAppMessage() {
    const trip = this.data.trip;

    return {
      title: `加入「${trip.name || '旅伴地图'}」一起收藏地点`,
      path: `/pages/home/home?tripId=${trip._id || app.globalData.activeTripId}`
    };
  },

  loadData() {
    if (!app.globalData.activeTripId) {
      this.setData({
        trip: {
          name: '新的旅行',
          city: '旅行',
          dateRange: '邀请朋友一起收藏地点',
          center: {
            latitude: 31.2304,
            longitude: 121.4737
          }
        },
        members: [],
        memberFilters: [
          { openid: 'all', nickName: '全部', avatarColor: '#475569', shortName: '全' }
        ],
        places: [],
        filteredPlaces: [],
        routeCount: 0
      });
      return;
    }

    api.listTripData(app.globalData.activeTripId).then((data) => {
      const memberFilters = [
        { openid: 'all', nickName: '全部', avatarColor: '#475569', shortName: '全' }
      ].concat(data.members.map((member) => Object.assign({}, member, {
        shortName: member.nickName.slice(0, 1)
      })));

      this.setData({
        trip: data.trip,
        members: data.members,
        memberFilters,
        places: data.places,
        routeCount: data.routePlan.placeIds.length
      });
      this.applyFilters();
    });
  },

  updateDraft(event) {
    const field = event.currentTarget.dataset.field;
    const draftTrip = Object.assign({}, this.data.draftTrip, {
      [field]: event.detail.value
    });

    this.setData({ draftTrip });
  },

  createTrip() {
    const draft = this.data.draftTrip;
    if (!draft.name || !draft.city) {
      wx.showToast({ title: '请填写名称和城市', icon: 'none' });
      return;
    }

    api.createTrip({
      name: draft.name,
      city: draft.city,
      dateRange: draft.dateRange,
      center: this.data.trip.center,
      nickName: app.globalData.user.nickName,
      avatarColor: app.globalData.user.avatarColor
    }).then((res) => {
      app.globalData.activeTripId = res.trip._id;
      wx.setStorageSync('activeTripId', res.trip._id);
      wx.showToast({ title: '旅行已创建' });
      this.loadData();
    });
  },

  applyFilters() {
    const { places, activeMember, activeCategory } = this.data;
    const filteredPlaces = places.filter((place) => {
      const memberOk = activeMember === 'all' || place.createdBy === activeMember;
      const categoryOk = activeCategory === '全部' || place.category === activeCategory;
      return memberOk && categoryOk;
    });

    this.setData({ filteredPlaces });
  },

  selectMember(event) {
    this.setData({ activeMember: event.currentTarget.dataset.openid }, () => this.applyFilters());
  },

  selectCategory(event) {
    this.setData({ activeCategory: event.currentTarget.dataset.category }, () => this.applyFilters());
  },

  goMap() {
    wx.switchTab({ url: '/pages/map/map' });
  },

  goRoute() {
    wx.switchTab({ url: '/pages/route/route' });
  },

  openPlace(event) {
    wx.navigateTo({
      url: `/pages/place/place?id=${event.currentTarget.dataset.id}`
    });
  },

  addPlaceBySearch() {
    wx.chooseLocation({
      success: (res) => {
        this.collectPlaceMeta(res);
      },
      fail: () => {
        wx.showToast({
          title: '可在地图页添加',
          icon: 'none'
        });
      }
    });
  },

  collectPlaceMeta(location) {
    wx.showActionSheet({
      itemList: ['景点', '餐厅', '街区', '购物'],
      success: (categoryRes) => {
        const category = ['景点', '餐厅', '街区', '购物'][categoryRes.tapIndex];
        wx.showModal({
          title: '地点备注',
          editable: true,
          placeholderText: '例如：晚上去、适合拍照、朋友强推',
          success: (noteRes) => {
            api.savePlace({
              name: location.name || '新地点',
              address: location.address || '地图选点',
              latitude: location.latitude,
              longitude: location.longitude,
              category,
              note: noteRes.content || '朋友新收藏的地点',
              status: 'want'
            }).then(() => this.loadData());
          }
        });
      }
    });
  }
});
