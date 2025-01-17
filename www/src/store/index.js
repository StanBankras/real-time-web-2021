import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

/* eslint-disable no-new */
const store = new Vuex.Store({
  state: {
    tickers: ['ETH/USDT', 'NULS/USDT', 'GBP/USDT', 'BTC/USDT'],
    allTickers: [],
    binanceSocket: undefined,
    trades: {},
    rooms: {},
    roomId: undefined,
    userName: undefined
  },
  getters: {
    tickers: state => state.tickers,
    trades: state => state.trades,
    allTickers: state => state.allTickers,
    rooms: state => state.rooms,
    roomId: state => state.roomId,
    userName: state => state.userName
  },
  mutations: {
    SET_WEBSOCKET(state, payload) {
      state.binanceSocket = payload;
    },
    SET_TRADE(state, payload) {
      const exists = !!state.trades[payload.ticker];
      state.trades[payload.ticker] = payload.trade;
      if(!exists) {
        state.trades = JSON.parse(JSON.stringify(state.trades));
      }
    },
    SET_ALL_TICKERS(state, payload) {
      state.allTickers = payload;
    },
    EDIT_TICKERS(state, payload) {
      state.tickers = payload;
    },
    SET_ROOM_ID(state, payload) {
      if(!payload) return state.roomId = undefined;
      state.roomId = payload;
    },
    SET_USERNAME(state, payload) {
      state.userName = payload;
    },
    SET_ROOMS(state, payload) {
      payload.forEach(room => state.rooms[room.roomId] = room);
      state.rooms = JSON.parse(JSON.stringify(state.rooms));
    }
  },
  actions: {
    initialWSSubscribe({ commit, state }) {
      commit('SET_WEBSOCKET', new WebSocket('wss://stream.binance.com:9443/stream'));

      const streams = state.tickers.map(ticker => ticker.toLowerCase().replace('/', '') + '@aggTrade');
      state.binanceSocket.onopen = () => {
        state.binanceSocket.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: streams,
          id: 1 }
        ));
      }    

      state.binanceSocket.onmessage = trade => {
        if(JSON.parse(trade.data).id) return;
        
        const data = JSON.parse(trade.data).data;
        commit('SET_TRADE', { ticker: data.s, trade: {
          rate: Number(data.p),
          volume: Number(data.q),
          date: Date.now()
        }});
      }
    },
    loadTickers({ commit }) {
      fetch('https://api.binance.com/api/v3/exchangeInfo')
        .then(response => response.json())
        .then(data => commit('SET_ALL_TICKERS', data.symbols.map(ticker => `${ticker.baseAsset}/${ticker.quoteAsset}`)));
    },
    editTicker({ commit, state }, payload) {
      const index = state.tickers.indexOf(payload.old);
      const tickers = state.tickers;
      tickers[index] = payload.new;
      commit('EDIT_TICKERS', tickers);

      state.binanceSocket.send(JSON.stringify({ 
        method: 'UNSUBSCRIBE',
        params: [payload.old.replace('/', '').toLowerCase() + '@aggTrade'],
        id: 312 }
      ));

      state.binanceSocket.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: [payload.new.replace('/', '').toLowerCase() + '@aggTrade'],
        id: 1 }
      ));
    },
    loadUserName({ commit }) {
      const userName = localStorage.getItem('userName');
      if(userName) commit('SET_USERNAME', userName);
    },
    loadRooms({ commit }) {
      let rooms = localStorage.getItem('rooms');
      if(rooms) {
        commit('SET_ROOMS', JSON.parse(rooms));
      }
    },
    setRoomId({ commit }, payload) {
      commit('EDIT_TICKERS', payload.activeTickers);
      commit('SET_ROOMS', [payload]);
      commit('SET_ROOM_ID', payload.roomId);

      let rooms = localStorage.getItem('rooms');
      if(rooms) {
        rooms = JSON.parse(rooms);
        if(rooms.find(r => r.roomId === payload.roomId)) return;
        rooms.push({ roomId: payload.roomId, name: payload.name });
        localStorage.setItem('rooms', JSON.stringify(rooms));
      } else {
        localStorage.setItem('rooms', JSON.stringify([{ roomId: payload.roomId, name: payload.name }]));
      }
    },
    SOCKET_new_user({ commit, state }, payload) {
      const room = state.rooms[payload.roomId];
      if(!room) return;

      if(!room.users) {
        room.users = [payload.user];
      } else {
        room.users.push(payload.user);
      }

      commit('SET_ROOMS', [room]);
    },
    SOCKET_remove_user({ commit, state }, payload) {
      console.log(payload);
      const room = state.rooms[payload.roomId];
      if(!room) return;

      if(room.users) {
        room.users = room.users.filter(u => u.id !== payload.id);
      }

      commit('SET_ROOMS', [room]);
    }
  }
});

export default store;
