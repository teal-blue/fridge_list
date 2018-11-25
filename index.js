// ���W���[���̃C���|�[�g
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var dateformat = require('dateformat');

// �J���Ŏg���|�[�g�ԍ�
const LOCAL_PORT_NUMBER = 5000;

// ----�������Ɛݒ�----
var app = express();
app.set('port', (process.env.PORT || LOCAL_PORT_NUMBER));
app.set('x-powered-by', false);
app.set('case sensitive routing', true);
app.set('strict routing', true);
app.use(bodyParser.json());

//Trello�̏��
const key = '<�L�[>';
const token = '<�g�[�N��>';
const list_fridge = '<�①�Ƀ��X�g��ID>';
const list_buy = '<���������X�g��ID>';

/**
 * google�A�V�X�^���g����Ăяo���֐�
 */
app.post('/operation_task', function (req, res, next) {
  console.log('=====[REQUEST]====');
  console.log(req.body);

  // ���N�G�X�g�ɕK�v�ȃp�����[�^���܂܂�Ă��Ȃ��ꍇ�́A�ȍ~�̏����𒆎~����
  if (!req.body || !req.body.queryResult || !req.body.queryResult.parameters) {
    return res.status(400).send('No parameters.');
  }
  
  var reqParam =req.body.queryResult.parameters;
  var in_out = reqParam['in-out'].toString();
    
  return new Promise((resolve, reject) => {
    if (in_out == 'in') {
      in_fridge(req, res, next)
      .then((response)=> {
      // ���X�|���X���b�Z�[�W 
        res.json({
          fulfillmentText: response
        });
      });
    } else {
      out_fridge (req, res, next)
      .then((response)=> {
      // ���X�|���X���b�Z�[�W 
        res.json({
          fulfillmentText: response
        });
      });
    }
  });
});

/**
 * �①�ɂɒǉ�����
 * @return {string} ���X�|���X���b�Z�[�W
 */
function in_fridge(req, res, next) {
  return new Promise((resolve, reject) => {
    // �H�i���擾����
    var reqParam = req.body.queryResult.parameters;
    var task = reqParam['content'].toString();
    console.log('=====[content]====');
    console.log(task);
    // �P�ꂪ���p�X�y�[�X�ŋ�؂��Ă���̂ł�����폜
    var content = task.replace(/ /g, '');
  
    // �ܖ��������擾����
    var dateTime = Date.parse(reqParam['date'].toString());
    var dateStr = dateformat(dateTime, 'yyyy-mm-dd');
    console.log('=====[date]====');
    console.log(dateStr);
  
    var resText = '';
    
    //���������X�g�ɓ����Ă��邩�m�F����
    get_card_id(list_buy, content)
    // ���������X�g����폜����
    .then(delete_card)
    .then(function(res){
      //�폜��������̃��b�Z�[�W���i�[
      resText += '���������X�g����' + res;
      
      // �①�ɂɒǉ�����
      return add_card(list_fridge, content, dateStr);
    })
    .then(function(res){
      //�ǉ���������̃��b�Z�[�W���i�[
      resText += res;
      resolve(resText);
    });
  });
}

/**
 * �①�ɂ�����o��
 * @return {string} ���X�|���X���b�Z�[�W
 */
function out_fridge(req, res, next) {
  return new Promise((resolve, reject) => {
    // �H�i���擾����
    var reqParam = req.body.queryResult.parameters;
    var task = reqParam['content'].toString();
    console.log('=====[content]====');
    console.log(task);
    // �P�ꂪ���p�X�y�[�X�ŋ�؂��Ă���̂ł�����폜
    var content = task.replace(/ /g, '');
    
    // �������ǂ����̃t���O���擾����
    var buy = reqParam['buy'].toString();
    console.log('=====[buy]====');
    console.log(buy);
    
    var resText = '';
    
    // �①�ɂɓ����Ă��邩�m�F����
    get_card_id(list_fridge, content)
    // �①�ɂ���폜����
    .then(delete_card)
    .then(function(res){
      //�폜��������̃��b�Z�[�W���i�[
      resText += '�①�ɂ���' + res;
      
      // ���������X�g�ɒǉ�����
      // �����͂����������ɍs���y�j���ɂ���
      var due = new Date();
      due.setDate(due.getDate() - due.getDay() - 1 + 7);
      var dateStr = dateformat(due, 'yyyy-mm-dd');
      return add_card(list_buy, content, dateStr);
    })
    .then(function(res){
      //�ǉ���������̃��b�Z�[�W���i�[
      resText += res;
      resolve(resText);
    });
  });
}

/**
 * ���X�g����J�[�h��T��
 * @param {string} list_id ���X�gID
 * @param {string} card_name �J�[�h��
 * @return {string} �J�[�hID
 */
function get_card_id (list_id, card_name) {
  return new Promise((resolve, reject) => {
    console.log('=====[get_card_id]====');
    var options = {
      uri: 'https://api.trello.com/1/lists/' + list_id + '/cards?key=' + key + '&token=' + token + '&fields=id,name',
    };
    
    // GET����
    request.get(options, function (error, response, body) {
      if (error) {
        console.log('=====[ERROR]====');
        console.log(error);
      } else {
        console.log('=====[BODY]====');
        var info = JSON.parse(body);
        for (var i in info) {
          //�擾�����J�[�h���X�g����T��
          if (info[i].name.toString() === card_name) {
            var card_id = info[i].id.toString();
            console.log(card_id);
            resolve(card_id);
            return;
          }
        }
        // ������Ȃ������ꍇ�͋󕶎���Ԃ�
        resolve('');
      }
    });
  });
}

/**
 * ���X�g�ɃJ�[�h��ǉ�����
 * @param {string} list_id ���X�gID
 * @param {string} card_name �J�[�h��
 * @param {string} due ����(yyyy-mm-dd)
 * @return {bool} resolve ���X�|���X���b�Z�[�W
 */
function add_card (list_id, card_name, due) {
  return new Promise((resolve, reject) => {
    console.log('=====[add_card]====');
    
    var listName = list_id === list_fridge ? '�①��' : '���������X�g';
    //���X�g�ɒǉ�����
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
  
    // POST����
    request.post(options, function (error, response, body) {
      // �ԓ����e
      if (error) {
        console.log('=====[ERROR]====');
        console.log(error);
        resolve(listName + '�ɓo�^�ł��܂���ł����B');
      } else {
        console.log('=====[BODY]====');
        console.log(body);
        resolve(listName + '��' + card_name + '��o�^���܂����B������' + due + '�ł��B');
      }
    });
  });
}

/**
 * �J�[�h���폜����
 * @param {string} card_id �J�[�hID
 * @return {bool} resolve ���X�|���X���b�Z�[�W
 */
function delete_card (card_id) {
  return new Promise((resolve, reject) => {
    console.log('=====[delete_card]====');
    if (!card_id) {
      resolve('������܂���ł����B');
      return;
    }
    
    //���X�g�ɒǉ�����
    var options = {
      uri: 'https://api.trello.com/1/cards/' + card_id +'?key=' + key + '&token=' + token,
    };
  
    // DELETE����
    request.delete(options, function (error, response, body) {
      // �ԓ����e
      if (error) {
        console.log('=====[ERROR]====');
        console.log(error);
        resolve('�폜�ł��܂���ł����B');
      } else {
        console.log('=====[BODY]====');
        resolve('�폜���܂����B');
      }
    });
  });
}

// �������Ƀ|�[�g�ԍ��A�������ɃR�[���o�b�N�֐����w�肵�āA�T�[�o���N��
var server = app.listen(app.get('port'), function () {
  console.log('http server is running...');

  // ���łɏI�����Ă��邩�ǂ����̃t���O
  var isFinished = false;

  process.on('SIGTERM', () => {
    // ���łɏI�����Ă���ꍇ�͉������Ȃ�
    if (isFinished) {
      return;
    }
    isFinished = true;

    console.log('http server is closing...');

    // �T�[�o���~����
    server.close(function () {
      console.log('http server closed.');

      // ����I��
      process.exit(0);
    });
  });
});

// �T�[�o�̃G���[���Ď�����
server.on('error', function (err) {
    console.error(err);

    // �ُ�I��
    process.exit(1);
});
