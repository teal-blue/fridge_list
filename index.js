// モジュールのインポート
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var dateformat = require('dateformat');

// 開発で使うポート番号
const LOCAL_PORT_NUMBER = 5000;

// ----初期化と設定----
var app = express();
app.set('port', (process.env.PORT || LOCAL_PORT_NUMBER));
app.set('x-powered-by', false);
app.set('case sensitive routing', true);
app.set('strict routing', true);
app.use(bodyParser.json());

//Trelloの情報
const key = '<キー>';
const token = '<トークン>';
const list_fridge = '<冷蔵庫リストのID>';
const list_buy = '<買い物リストのID>';

/**
 * googleアシスタントから呼び出す関数
 */
app.post('/operation_task', function (req, res, next) {
  console.log('=====[REQUEST]====');
  console.log(req.body);

  // リクエストに必要なパラメータが含まれていない場合は、以降の処理を中止する
  if (!req.body || !req.body.queryResult || !req.body.queryResult.parameters) {
    return res.status(400).send('No parameters.');
  }
  
  var reqParam =req.body.queryResult.parameters;
  var in_out = reqParam['in-out'].toString();
    
  return new Promise((resolve, reject) => {
    if (in_out == 'in') {
      in_fridge(req, res, next)
      .then((response)=> {
      // レスポンスメッセージ 
        res.json({
          fulfillmentText: response
        });
      });
    } else {
      out_fridge (req, res, next)
      .then((response)=> {
      // レスポンスメッセージ 
        res.json({
          fulfillmentText: response
        });
      });
    }
  });
});

/**
 * 冷蔵庫に追加する
 * @return {string} レスポンスメッセージ
 */
function in_fridge(req, res, next) {
  return new Promise((resolve, reject) => {
    // 食品を取得する
    var reqParam = req.body.queryResult.parameters;
    var task = reqParam['content'].toString();
    console.log('=====[content]====');
    console.log(task);
    // 単語が半角スペースで区切られているのでそれを削除
    var content = task.replace(/ /g, '');
  
    // 賞味期限を取得する
    var dateTime = Date.parse(reqParam['date'].toString());
    var dateStr = dateformat(dateTime, 'yyyy-mm-dd');
    console.log('=====[date]====');
    console.log(dateStr);
  
    var resText = '';
    
    //買い物リストに入っているか確認する
    get_card_id(list_buy, content)
    // 買い物リストから削除する
    .then(delete_card)
    .then(function(res){
      //削除処理からのメッセージを格納
      resText += '買い物リストから' + res;
      
      // 冷蔵庫に追加する
      return add_card(list_fridge, content, dateStr);
    })
    .then(function(res){
      //追加処理からのメッセージを格納
      resText += res;
      resolve(resText);
    });
  });
}

/**
 * 冷蔵庫から取り出す
 * @return {string} レスポンスメッセージ
 */
function out_fridge(req, res, next) {
  return new Promise((resolve, reject) => {
    // 食品を取得する
    var reqParam = req.body.queryResult.parameters;
    var task = reqParam['content'].toString();
    console.log('=====[content]====');
    console.log(task);
    // 単語が半角スペースで区切られているのでそれを削除
    var content = task.replace(/ /g, '');
    
    // 買うかどうかのフラグを取得する
    var buy = reqParam['buy'].toString();
    console.log('=====[buy]====');
    console.log(buy);
    
    var resText = '';
    
    // 冷蔵庫に入っているか確認する
    get_card_id(list_fridge, content)
    // 冷蔵庫から削除する
    .then(delete_card)
    .then(function(res){
      //削除処理からのメッセージを格納
      resText += '冷蔵庫から' + res;
      
      // 買い物リストに追加する
      // 期限はいつも買い物に行く土曜日にする
      var due = new Date();
      due.setDate(due.getDate() - due.getDay() - 1 + 7);
      var dateStr = dateformat(due, 'yyyy-mm-dd');
      return add_card(list_buy, content, dateStr);
    })
    .then(function(res){
      //追加処理からのメッセージを格納
      resText += res;
      resolve(resText);
    });
  });
}

/**
 * リストからカードを探す
 * @param {string} list_id リストID
 * @param {string} card_name カード名
 * @return {string} カードID
 */
function get_card_id (list_id, card_name) {
  return new Promise((resolve, reject) => {
    console.log('=====[get_card_id]====');
    var options = {
      uri: 'https://api.trello.com/1/lists/' + list_id + '/cards?key=' + key + '&token=' + token + '&fields=id,name',
    };
    
    // GETする
    request.get(options, function (error, response, body) {
      if (error) {
        console.log('=====[ERROR]====');
        console.log(error);
      } else {
        console.log('=====[BODY]====');
        var info = JSON.parse(body);
        for (var i in info) {
          //取得したカードリストから探す
          if (info[i].name.toString() === card_name) {
            var card_id = info[i].id.toString();
            console.log(card_id);
            resolve(card_id);
            return;
          }
        }
        // 見つからなかった場合は空文字を返す
        resolve('');
      }
    });
  });
}

/**
 * リストにカードを追加する
 * @param {string} list_id リストID
 * @param {string} card_name カード名
 * @param {string} due 期限(yyyy-mm-dd)
 * @return {bool} resolve レスポンスメッセージ
 */
function add_card (list_id, card_name, due) {
  return new Promise((resolve, reject) => {
    console.log('=====[add_card]====');
    
    var listName = list_id === list_fridge ? '冷蔵庫' : '買い物リスト';
    //リストに追加する
    var options = {
      uri: 'https://api.trello.com/1/cards',
      json: {
        'key' : key,
        'token' : token,
        'idList': list_id,
        'name': card_name,
        'due': due,
        'keepFromSource': 'all',
      }
    };
  
    // POSTする
    request.post(options, function (error, response, body) {
      // 返答内容
      if (error) {
        console.log('=====[ERROR]====');
        console.log(error);
        resolve(listName + 'に登録できませんでした。');
      } else {
        console.log('=====[BODY]====');
        console.log(body);
        resolve(listName + 'に' + card_name + 'を登録しました。期限は' + due + 'です。');
      }
    });
  });
}

/**
 * カードを削除する
 * @param {string} card_id カードID
 * @return {bool} resolve レスポンスメッセージ
 */
function delete_card (card_id) {
  return new Promise((resolve, reject) => {
    console.log('=====[delete_card]====');
    if (!card_id) {
      resolve('見つかりませんでした。');
      return;
    }
    
    //リストに追加する
    var options = {
      uri: 'https://api.trello.com/1/cards/' + card_id +'?key=' + key + '&token=' + token,
    };
  
    // DELETEする
    request.delete(options, function (error, response, body) {
      // 返答内容
      if (error) {
        console.log('=====[ERROR]====');
        console.log(error);
        resolve('削除できませんでした。');
      } else {
        console.log('=====[BODY]====');
        resolve('削除しました。');
      }
    });
  });
}

// 第一引数にポート番号、第二引数にコールバック関数を指定して、サーバを起動
var server = app.listen(app.get('port'), function () {
  console.log('http server is running...');

  // すでに終了しているかどうかのフラグ
  var isFinished = false;

  process.on('SIGTERM', () => {
    // すでに終了している場合は何もしない
    if (isFinished) {
      return;
    }
    isFinished = true;

    console.log('http server is closing...');

    // サーバを停止する
    server.close(function () {
      console.log('http server closed.');

      // 正常終了
      process.exit(0);
    });
  });
});

// サーバのエラーを監視する
server.on('error', function (err) {
    console.error(err);

    // 異常終了
    process.exit(1);
});
