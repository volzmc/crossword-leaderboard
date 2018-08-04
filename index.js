var http, director, router, server, port, redis, pug, express, app, https;

http = require('http');
HTTPS = require('https');
director    = require('director');
redis		= require('redis').createClient(process.env.REDIS_URL);
pug = require('pug');

var botID = process.env.BOT_ID;


router = new director.http.Router({
  '/' : {
    post: onMessageReceived,
    get: displayHome
    },
  '/User/:userID': {
      get: displayUserStats,
  }
});

//router.on('/User', displayUserStats);

server = http.createServer(function (req, res) {
  req.chunks = [];
  req.on('data', function (chunk) {
    req.chunks.push(chunk.toString());
  });

  router.dispatch(req, res, function(err) {
    res.writeHead(err.status, {"Content-Type": "text/plain"});
    res.end(err.message);
  });
});

port = Number(process.env.PORT || 5000);
server.listen(port);

function displayHome()
{
	var currentDate = getCurrentDay();
	var multi = redis.multi();
	multi.zrange(currentDate.toString(), 0, -1, 'withscores');
	multi.zrange("scoreIndex", 0, -1, 'withscores');
	multi.hgetall("Matt Volz");
	multi.hgetall("Ashwin R.");
	multi.hgetall("Shafat Hossain");
	multi.hgetall("David Lonergan");
	multi.hgetall("Alyson Meister");
    multi.lrange("winnersList", 0, -1);
    multi.lrange("seasonWinners", 0, -1);
	multi.exec(displayTimes.bind({"response": this.res, "pug": pug}));
}

var displayTimes = function(err, replies)
{
	var i, topTimes, todaysTimes, html, topScoresTable, todaysScoresTable,
		winsByName, winsByNameTable, streakInfo, streakInfoTable, htmlData, seasonWinners,
		mattAverageTime, shafatAverageTime, ashwinAverageTime, davidAverageTime, alysonAverageTime;
	for (i = 0; i < replies.length; i++)
	{
        if (i == 0) {
            todaysTimes = getTodaysTimes(replies[i]);
        }
        else if (i == 1) {
            topTimes = getTopTimes(replies[i]);
        }
        else if (i == 2) {
            mattAverageTime = getAverageTime(replies[i]);
        }
        else if (i == 3) {
            ashwinAverageTime = getAverageTime(replies[i]);
        }
        else if (i == 4) {
            shafatAverageTime = getAverageTime(replies[i]);
        }
        else if (i == 5) {
            davidAverageTime = getAverageTime(replies[i]);
        }
        else if (i == 6) {
            alysonAverageTime = getAverageTime(replies[i]);
        }
        else if (i == 7) {
            winsByName = getWinsByName(replies[i], mattAverageTime, ashwinAverageTime, shafatAverageTime, davidAverageTime, alysonAverageTime);
            streakInfo = getStreakInfo(replies[i]);
        }
        else if (i == 8) {
            seasonWinners = getSeasonWinners(replies[i]);
        }
	}

	htmlData = {
		"topScores": topTimes,
		"todaysScores": todaysTimes,
		"winsByName": winsByName,
        "streakInfo": streakInfo,
        "seasonWinners": seasonWinners
	}

	html = this.pug.renderFile('templates/homeview.pug', htmlData);
	this.response.writeHead(200, {"Content-Type": "text/html"});
	this.response.end(html);
}

var getSeasonWinners = function (scores) {
    var seasonWinners = [];
    for (var i = 0; i < scores.length; i++) {
        var winner = {};
        winner.name = scores[i];
        winner.seasonNumber = i + 1;
        seasonWinners.push(winner);
    }
    return seasonWinners;
}

var getTopTimes = function(scores)
{
	var topScores, i, currentScore, place;
	currentScore = {};
	topScores = [];
	place = 1;

	for (var i = 0; i < Math.min(scores.length, 40); i++)
	{
		if (i % 2 === 0)
		{
			var name = scores[i];
			currentScore.name = name.substring(0, name.indexOf(":"));
		}
		else
		{
			currentScore.time = scoreToTime(scores[i]);
			currentScore.place = place;
			topScores.push(currentScore);
			currentScore = {};
			place++;
		}
	}
	return topScores;
}

var getWinsByName = function(scores, mattAvg, ashwinAvg, shafatAvg, davidAvg, alysonAvg)
{
	var i, currentPlayer, winnerList, key, value;
	var dictionary = {};
	currentPlayer = {};
	winnerList =[];

	for (i = 0; i < scores.length; i++)
	{
		if (dictionary[scores[i]])
		{
			dictionary[scores[i]] = Number(dictionary[scores[i]]) + 1;
		}
		else
		{
			dictionary[scores[i]] = 1;
		}
	}

	for (key in dictionary)
	{
		currentPlayer.name = key;
		currentPlayer.wins = dictionary[key];
		switch (key)
		{
			case "Matt Volz":
			currentPlayer.averageTime = mattAvg;
			break;
			case "Ashwin R.":
			currentPlayer.averageTime = ashwinAvg;
			break;
			case "Shafat Hossain":
			currentPlayer.averageTime = shafatAvg;
			break;
			case "David Lonergan":
			currentPlayer.averageTime = davidAvg;
			break;
			case "Alyson Meister":
			currentPlayer.averageTime = alysonAvg;
			break;
		}
		winnerList.push(currentPlayer);
		currentPlayer = {};
	}
	winnerList.sort(sortWinnerList);
	return winnerList;
}

var sortWinnerList = function(playerA, playerB)
{
	return (playerB.wins > playerA.wins);
}

var getStreakInfo = function(scores)
{
	var streakInfo, i, currentStreak, lastWinner, currentWinner, currentWinnerStreak, longestWinner, maxStreak;
	streakInfo = {};
	currentStreak = 0;
	lastWinner = scores[0];

	for (i = 0; i < scores.length; i++)
	{
		if (lastWinner === scores[i])
		{
			currentStreak++;
		}
		else
		{
			currentWinnerStreak = currentStreak;
			longestWinner = lastWinner;
			maxStreak = currentStreak;
			currentStreak = 0;
			break;
		}
	}
	lastWinner = "";
	for (i = 0; i < scores.length; i++)
	{
		if (lastWinner === scores[i])
		{
			currentStreak++;
		}
		else
		{
			if (currentStreak > maxStreak)
			{
				maxStreak = currentStreak;
				longestWinner = scores[i];
			}
			currentStreak = 1;
			lastWinner = scores[i];
		}
		if (currentStreak > maxStreak)
		{
			maxStreak = currentStreak;
			longestWinner = scores[i];
		}
	}

	streakInfo = {
		"CurrentStreak": currentWinnerStreak,
		"CurrentWinner": scores[0],
		"LongestStreak": maxStreak,
		"LongestWinner": longestWinner,
	};
	return streakInfo;
}

var getTodaysTimes = function(scores)
{
	var todaysScores, i, currentPlayer, place;
	currentPlayer = {};
	todaysScores = [];
	place = 1;

	for (var i = 0; i < scores.length; i++)
	{
		if (i % 2 === 0)
		{
			currentPlayer.name = scores[i];
		}
		else
		{
			currentPlayer.time = scoreToTime(scores[i]);
			currentPlayer.place = place;
			todaysScores.push(currentPlayer);
			currentPlayer = {};
			place++;
		}
	}
	return todaysScores;
}

function onMessageReceived()
{
	var data, timeRegex, timeString, cur;
	data = JSON.parse(this.req.chunks[0]);
    timeRegex = /\[.*?\]/m

    if (data.text === "/scoreboard")
    {
        postMessage("https://crossword-leaderboard.herokuapp.com");
    }
    else
    {
        timeString = timeRegex.exec(data.text);

        if (timeString) {
            timeString = timeString[0].replace("[", "");
            timeString = timeString.replace("]", "");
            addNewTime(data, timeString);
        }

        this.res.writeHead(200);
        this.res.end();
    }

	
}

function postMessage(data) {
    var botResponse, options, body, botReq;

    botResponse = data;

    options = {
        hostname: 'api.groupme.com',
        path: '/v3/bots/post',
        method: 'POST'
    };

    body = {
        "bot_id": botID,
        "text": botResponse
    };

    botReq = HTTPS.request(options, function (res) {
        if (res.statusCode == 202) {
            //neat
        } else {
            console.log('rejecting bad status code ' + res.statusCode);
        }
    });

    botReq.on('error', function (err) {
        console.log('error posting message ' + JSON.stringify(err));
    });
    botReq.on('timeout', function (err) {
        console.log('timeout posting message ' + JSON.stringify(err));
    });
    botReq.end(JSON.stringify(body));
}

function addNewTime(data, timeString)
{
	var minuteString, secondsString, timeInSeconds, day;
	minuteString = timeString.substring(0, timeString.indexOf(":"));
	secondsString = timeString.substring(timeString.indexOf(":") + 1, timeString.length);

	timeInSeconds = (Number(minuteString) * 60) + Number(secondsString);
	day = getCurrentDay();

	redis.zadd(day.toString(), timeInSeconds, data.name);
	redis.zadd("scoreIndex", timeInSeconds, data.name + ":" + day.toString());

	redis.hgetall(data.name, individualStatsReceived.bind({"newTime": timeInSeconds, "name": data.name, "client": redis}));
}

var getAverageTime = function(playerObject)
{
    if (playerObject !== null)
    {
        return scoreToTime(Math.round(Number(playerObject.totalTime) / Number(playerObject.totalDaysSubmitted)));
    }
    else
    {
        return "No data";
    }
}

function individualStatsReceived(err, obj)
{
	var totalDaysSubmitted, totalTime, userObject;
	if (obj)
	{
		userObject = {
			name: this.name,
			totalDaysSubmitted: Number(obj.totalDaysSubmitted) + 1,
			totalTime: Number(obj.totalTime) + this.newTime
		}
	}
	else
	{
		userObject = {
			name: this.name,
			totalDaysSubmitted: 1,
			totalTime: this.newTime
		}
	}
	this.client.hmset(userObject.name, userObject);
}

function getCurrentDay()
{
	var day, currentDate, startDate, dayInUTC;
	currentDate = new Date();
	startDate = new Date(2017, 3, 17, 0, 0, 0, 0);
	dayInUTC = currentDate.getTime() - startDate.getTime() - (1000 * 60 *60);
	day = (dayInUTC / (1000 * 60 * 60 * 24));
	return Math.floor(day);
}

function scoreToTime(score)
{
	var rawScore, seconds, minutes, secondsString;
	rawScore = Number(score);
	seconds = rawScore % 60;
	minutes = Math.floor(rawScore / 60);
	if (seconds < 10)
	{
		secondsString = "0" + seconds;
	}
	else
	{
		secondsString = seconds.toString();
	}
	return minutes + ":" + secondsString;
}


function displayUserStats(userID)
{
    var name;
    var multi = redis.multi();
    name = getNameFromId(userID);
    this.res.writeHead(200, { "Content-Type": "text/html" });
    this.res.end("<p>" + name + "</p>");
}

function getNameFromId(id)
{
    switch (id)
    {
        case "1":
            return "Matt Volz";
        case "2":
            return "David Lonergan";
        case "3":
            return "Shafat Hossain";
        case "4":
            return "Ashwin R.";
        case "4":
            return "Alyson Meister";
    }
}

function displayIndividualPage()
{

}

