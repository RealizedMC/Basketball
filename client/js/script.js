var app = angular.module('basketball', ['ngRoute']);

app.config(function($routeProvider) {
	$routeProvider
	.when('/', {
		templateUrl: '/partials/login.html'
	})
	.when('/play', {
		templateUrl: '/partials/game.html'
	})
	.otherwise({
		redirectTo: '/'
	});
});

app.factory('socket', function($rootScope) {
	var socket = io.connect();

	return {
		on: function(eventName, callback) {
			socket.on(eventName, function() {
				var args = arguments;

				$rootScope.$apply(function() {
					callback.apply(socket, args);
				});
			});
		},

		emit: function(eventName, data, callback) {
			socket.emit(eventName, data, function() {
				var args = arguments;

				$rootScope.$apply(function() {
					if (callback) {
						callback.apply(socket, args);
					}
				});
			})
		},

		currentId: function() {
			return socket.id;
		}
	};
});

app.controller('LoginController', function($scope, $location, socket) {
	$scope.proceed = function() {
		if (!$scope.user || !$scope.user.name) {
			alert('Please enter a valid nickname.');
			return;
		}

		socket.emit('login', {name: $scope.user.name});
	}

	socket.on('login_response', function(data) {
		if (data.error) {
			alert(data.error);
		} else {
			$location.url('/play');
		}
	});
});

app.controller('GameController', function($scope, $location, socket) {
	socket.emit('join');

	socket.on('join_response', function(data) {
		if (data.error) {
			alert(data.error);
			location.href = '/';
			return;
		}

		var canvas = document.createElement("CANVAS");
	    canvas.id = "map";
	    canvas.height = data.height;
	    canvas.width = data.width;
	    var div = document.getElementById('sky');
	    div.appendChild(canvas);

		$scope.send_message = function() {
			socket.emit('message', $scope.new_message);

			if ($scope.new_message.message && $scope.new_message.message[0] == '-') {
				socket.emit('throw', {time_held: parseInt($scope.new_message.message.substring(1))});
			}

			$scope.new_message = {};
		}

		socket.on('message', function(data) {
			if (data && data.message) {
				$('#messages').prepend('<p class="messages">' + data.message + '</p>');
			}
		});

		var last = 0;

		var last_key_down = 0;
		var first_press = true;

		$(document).ready(function() {
			socket.on('update', function(data) {
				var canvas = document.getElementById('map');

				if (!canvas) {
					return;
				}

				var ctx = canvas.getContext('2d');
				var client = data.self;

				var image = 'still';

				ctx.clearRect(0, 0, canvas.width, canvas.height);
				$('#scores td').parent().remove();

			    var new_html = '';

				for (var i in data.players) {
					var client = data.players[i];

					var is_self = false;
	
					if (client.id && client.id.substring(2) == socket.currentId()) {
						is_self = true;
					}

					ctx.beginPath();
					ctx.drawImage(document.getElementById(image), client.x, client.y);
					ctx.font = 'bold 10pt Tahoma';
			        ctx.fillStyle = is_self ? 'blue' : 'black';
			        ctx.textAlign = 'center';
			        ctx.fillText(is_self ? 'You' : client.name, client.x + 30, client.y + 5);
					ctx.closePath();
					new_html += '<tr><td>' + (is_self ? '<span style="color: blue; font-weight: bold;">You</span>' : client.name) + '</td><td><span style="color: green;">' + client.score + '</span></td></tr>';
				}

				$('#scores').append(new_html);

				for (var i = 0; i < data.balls.length; i++) {
					var curr = data.balls[i];
					ctx.beginPath();
					ctx.arc(curr.x, curr.y, 15, 0, 2 * Math.PI);
			        ctx.fillStyle = 'darkorange';
			        ctx.fill();
			        ctx.closePath();
			    }

			    ctx.beginPath();
			    ctx.drawImage(document.getElementById('hoop'), 400, 140);
			    ctx.closePath();

			    if (new Date().getTime() - last >= 5000) {
			    	last = new Date().getTime();
			    	console.log(data);
			    }
			});

			$(document.body).keydown(function(event) {
				if (document.activeElement && document.activeElement.id == 'message') {
					return;
				} 

				if (event.keyCode == 32) {
					event.preventDefault();
					var now = new Date().getTime();

					if (first_press) {
						last_key_down = now;
						first_press = false;
					}

					var time_held = (now - last_key_down);

					var color = '#ff7f7f';

					var colors = {
						1000: '#ff6666',
						2000: '#ff4c4c',
						3000: '#ff3232',
						4000: '#ff1919',
						5000: '#ff0000',
						6000: '#e50000',
					};

					for (var time in colors) {
						if (time_held > time) {
							color = colors[time];
						}
					}

					var height = $('#power_bar').css('height');
					$('#power_bar').css('height', (parseInt(height.substring(0, height.length - 1)) + 5) + 'px');

					if (time_held > 8500) {
						$('#power_bar').css('height', '0px');
						first_press = true;
						var time_held = (new Date().getTime() - last_key_down);
						socket.emit('throw', {time_held: time_held});
					}
				} else if (event.keyCode == 37 || event.keyCode == 39) {
					event.preventDefault();
					socket.emit('move', {keyCode: event.keyCode});
				}
			});

			$(document.body).keyup(function(event) {
				if (document.activeElement && document.activeElement.id == 'message') {
					return;
				} 

				if (event.keyCode == 32) {
					event.preventDefault();

					if (!first_press) {
						$('#power_bar').css('height', '0px');
						first_press = true;
						var time_held = (new Date().getTime() - last_key_down);
						console.log('Thrown at: ' + time_held);
						socket.emit('throw', {time_held: time_held});
					}
				}
			});
		});
	});
});