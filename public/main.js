$(document).ready(function(){
        // Setup
        var DEBUG_MODE = true;
        var clippyEndPoint = "http://localhost:3001";

        const PromptMaxLength = 40;
        const PromptMaxLines = 20;

        // Timers
        var startTime;
        const TimeLimit = 45*60; // 45 minutes
        const ClippyTimer = DEBUG_MODE ? 1000 : 120*1000; // Time for clippy to start helping.
        const HalBeepingRate = 3500; // milliseconds
        const LoadTransitionTime = DEBUG_MODE ? 2000 : 20000; // milliseconds
        const IllegalOperationTimeout = DEBUG_MODE ? 3000 : 10000; // milliseconds
        const CommandPromptDelay = DEBUG_MODE ? 1000 : 10000;
        
		// Clippy Messages
		const welcome = {"message": "Welcome to Cl.0@2#%d^&*443-0-4fdsg*j--+33jj", "icon":"note.png", "sound": "Clippy_TransformToCheckMark.wav"};
		const noUserPass = {"message": "Hey, there. Do you even know how to use a computer? <b>You have to type a username and a password!</b>", "icon": "keyboard.png", "sound": "Clippy_TransformToCheckMark.wav"};
		const noUserWithPass = {"message": "You gotta type in a username, genius.", "icon": "keyboard.png", "sound": "Clippy_TransformToCheckMark.wav"};
		const rightUsername = {"message": "<b>{usernames}</b>. What were you thinking?", "icon": "none", "sound": "Clippy_TransformToCheckMark.wav"};
		const TooManyWrongUsernames = {"message": "You know there is a <b>pattern</b>, right?", "icon": "note.png", "sound": "Clippy_TransformToCheckMark.wav"};
        const TooManyWrongPasswords = {"message": "Do you know how to <b>sum</b>?", "icon": "note.png", "sound": "Clippy_TransformToCheckMark.wav"};
        const BobTakingOverMessage = {"message": "Hey, there. Bob is corrupting itself to subvert the system. I'll see if I can load a command prompt!", "icon": "console_prompt.png", "sound": "Clippy_TransformToCheckMark.wav"};
		
        // State
		var triedBlankUserPass = false;
		var triedBlankUserWithPass = false;
		
		const WrongUsernameHintThreshold = DEBUG_MODE ? 3 : 7;
		var wrongUsernameTries = 0;
		
		const usernameHistoryMaxCount = 6;
		var usernameHistory = [];
		var foundRightUsername = false;
		
		const WrongPasswordHintThreshold = DEBUG_MODE ? 3 : 7;
        var wrongPasswordTries = 0;
        
		const IllegalDialogClicksThreshold = DEBUG_MODE ? 2 : 4;
        var illegalDialogClicks = 0;
        var launchedCommandPrompt = false;
        
        var halBeeper;

        // Audio 
        var errorAudio = new Audio('sounds/CHORD.WAV'); //wav is not the way to do things..
        var successAudio = new Audio('sounds/CHIMES.WAV');
        var failedAudio = new Audio('sounds/DING.WAV');
        var startupAudio = new Audio('sounds/win-startup.wav');
        var halBeepAudio = new Audio('sounds/hal-beep.wav');
       	
        /* SOCKET COMMUNICATION */
        var socket = io();
		
        // Will be fired when we see the hand near it. 
        socket.on('authenticated', function (data) {
            if(state == STATE_HAND)
            {
                if(data.response ==1) {
                    doAuthentication();
                } else {
                    //doHumanHand(); // Not working
                }
            }
        });
        
        $("#halscreen").show();
        $("#loadscreen").hide();
        $("#loginscreen").hide();
        $("#pinscreen").hide();
        $("#illegalopscreen").hide();
        $("#phonefactorscreen").hide();
        $("#promptscreen").hide();
        $("#ergoscreen").hide();
        $("#win31screen").hide();

        sendMessageToClippy(welcome);
        startTimer();
        startAnimations();
        setCommandPrompt();
        startTimeouts();

		// Form Events
		$("#loginform").submit(function (event) {
			event.preventDefault();
            processLogin($("#username").val(), $("#password").val());
        });
		
		$("#pinform").submit(function (event) {
			event.preventDefault();
            processPin($("#pin").val());
        });
		
		$("#ergoform").submit(function (event) {
			event.preventDefault();
            processErgo(processPin($("#ergo").val()));
        });

		// Other
        // $('input').focus(function(obj){
        //     $('.alert').fadeOut(500);
        // })
        
        function transition(currentScreen, nextScreen, delay, soundEffect, callback) {
            return currentScreen.fadeOut(delay/2, function() {
                if (soundEffect) {
                    soundEffect.play();
                }

                if (callback) {
                    callback();
                }

                return nextScreen.fadeIn(delay/2);
            });
        }
        
		// End Puzzle
        function showFailure(){
            showScreen(STATE_FAIL);
            //failedAudio.play();
        }

        function showSuccess(){
            showScreen(STATE_SUCCESS);
        }

        // Calls
        // Logic @ Login Screen
        function processLogin(username, password) {
            console.log("Username: " + username);
			console.log("Password: " + password);
			
			if (!username.length && !password.length) {
				if (!triedBlankUserPass)
				{
                    triedBlankUserPass = true;
					sendMessageToClippy(noUserPass);
				}
                
                return transition($("#loginscreen"), $("#loginscreen"), 1000, errorAudio, function() {
                    var errorMessage = "Ooops! Enter in a username or password!";
                    console.log("Error: " + errorMessage)
                    $(".login-error").show();
                    $(".login-error").text(errorMessage);
                });
			}
			else if (!username.length && password.length) {
				if (!triedBlankUserWithPass)
				{
                    triedBlankUserWithPass = true;
					sendMessageToClippy(noUserWithPass);
                }
                
                return transition($("#loginscreen"), $("#loginscreen"), 1000, errorAudio, function() {
                    var errorMessage = "Ooops! Enter in a username!";
                    console.log("Error: " + errorMessage)
                    $(".login-error").fadeIn(100);
                    $(".login-error").text(errorMessage);
                });
			}
			else {
				$.post("api/password", {"username": username, "password": password})
				.done(function(data) {
					console.log(data);
					switch(data.result) {
                        case "success":
                            return transition($("#loginscreen"), $("#pinscreen"), 1000, successAudio);
							
						case "wrong_username":
							if (!foundRightUsername)
							{
								usernameHistory.push(data.username);
								
								// Clean up history
								if (usernameHistory.length > usernameHistoryMaxCount) {
									usernameHistory.shift();
								}
							
								// Hint
								wrongUsernameTries++;
								
								if (wrongUsernameTries >= WrongUsernameHintThreshold) {
									wrongUsernameTries = 0;
									sendMessageToClippy(TooManyWrongUsernames);
								}
							}
                            
                            return transition($("#loginscreen"), $("#loginscreen"), 1000, errorAudio, function() {
                                var errorMessage = "Ooops! Wrong Username!";
                                console.log("Error: " + errorMessage)
                                $(".login-error").fadeIn(100);
                                $(".login-error").text(errorMessage)
                            });
							
						case "wrong_password":
							// Show usernames flavor
							if (!foundRightUsername && wrongUsernameTries > 0)
							{
								rightUsername.message = rightUsername.message.replace("{usernames}", usernameHistory.join(", "));
                                foundRightUsername = true;
                                sendMessageToClippy(rightUsername);
							}
							
							// Hint
							wrongPasswordTries++;
							
							if (wrongPasswordTries >= WrongPasswordHintThreshold) {
								wrongPasswordTries = 0;
								sendMessageToClippy(TooManyWrongPasswords);
                            }
                            
							return transition($("#loginscreen"), $("#loginscreen"), 1000, errorAudio, function() {
                                var errorMessage = "Ooops! Wrong Password!";
                                console.log("Error: " + errorMessage)
                                $(".login-error").fadeIn(100);
                                $(".login-error").text(errorMessage);
                            });
             
						default:
							console.log("Something went wrong");
					}
				});
			}
        }

        // Logic @ Pin Screen
        function processPin(pin) {
            console.log("PIN: " + pin);

            if (!pin.length) {
                return transition($("#pinscreen"), $("#pinscreen"), 1000, errorAudio, function() {
                    var errorMessage = "Enter a valid PIN number!";
                    console.log("Error: " + errorMessage)
                    $(".pin-error").show();
                    $(".pin-error").text(errorMessage);
                });
            }
            else {
                $.post("api/pin", { "pin": pin })
                    .done(function(data) {
                        console.log(data);
                        switch(data.result) {
                            case "success":
                                return transition($("#pinscreen"), $("#phonefactorscreen"), 1000, successAudio, function() {
                                    setTimeout(processPhone, IllegalOperationTimeout)
                                });
                            case "wrong_pin":
                                return transition($("#pinscreen"), $("#pinscreen"), 1000, errorAudio, function() {
                                    var errorMessage = "Incorrect PIN!";
                                    console.log("Error: " + errorMessage)
                                    $(".pin-error").show();
                                    $(".pin-error").text(errorMessage);
                                });
                            default:
                                console.log("Something went wrong");
                        }
				    });
            }
        }

        // Logic @ Phone Factor Screen 
        function processPhone() {
            var paddingleft = 0;
            var paddingtop = 0;

            var showIllegalOp = function () {
                errorAudio.play();
                var newIllegalBox = $(`
                <div class='window illegapopdialog' style="margin-left: ` + paddingleft + `px; margin-top: ` + paddingtop + `px">
                    <div class='header'>
                        <img class='icon' src='icons/windows.png' srcset='icons/windows.png 32w, icons/windows.png 64w' /> bob-9000.exe
                    </div>
    
                    <div class='content'>
                        <img class='contenticon' src="icons/msg_error.png" />
                        <div class="contentbuttons">
                            <button class='contentbutton'>Close</button>
                            <br>
                            <br>
                            <br>
                            <button class='contentbutton'>Details>></button>
                        </div>
                        This program has performed an illegal operation and will be shut down.<br><br> If the problem persists,
                        contact the program vendor.
                    </div>
                </div>`);
                newIllegalBox.appendTo("#illegalopscreen");
                newIllegalBox.on('click', '.contentbutton', function(){ 
                    illegalDialogClicks++;
                    if (illegalDialogClicks > IllegalDialogClicksThreshold) {
                        sendMessageToClippy(BobTakingOverMessage);
                        illegalDialogClicks = 0;

                        console.log("Launching prompt...");
                        if (!launchedCommandPrompt)
                        {
                            launchedCommandPrompt = true;
                            setTimeout(function() {
                                console.log("Prompt started!");
                                failedAudio.play();
                                $("#promptscreen").show();
                            }, CommandPromptDelay);
                        }
                    }

                    return showIllegalOp();
                });

                paddingleft += 20;
                paddingtop += 10;
            };

            showIllegalOp();

            return $("#illegalopscreen").show();
        }

        // Logic @ Command Prompt

        function processErgo() {
            if (ergo.value.length) {
                var params = "ergo=" + ergo.value;
                var xhr = new sendRequest('api/ergo', 'POST', params);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState == 4 && xhr.status == 200) {
                        //Failure
                        if (xhr.responseText == "0") {
                            showError("Incorrect ERGO");
                        } else {
                            //Success
                            //errorItem.innerHTML = "YAY"
                           
                            startHandProcess();
                            nextScreen();
                        }
                    }
                }
            } else {
                incrementError();
            }
        }

        /** Generic Send Request **/
        function sendRequest(url, type, params, handler) {
            var xhr = new XMLHttpRequest();
            xhr.open(type, url);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            //xhr.setRequestHeader("Content-length", params.length);
            //xhr.setRequestHeader("Connection", "close");
            xhr.send(params);
            return xhr;
        }


        /* START HAND PROCESS 
            Called after the last ergonomics puzzle is done. 
            Sends a message via SOCKETS --> SERIAL ( arduino )
            Starts a countdown Timer
        
        */
         function startHandProcess(){
             sendHandMessage();
             setTimer();
        }

        /* CLIPPY API
            Need to pass endpoint --> ie. clippyEndPoint+"/message";
            Need to pass data --> {'message':'put your message here'}
         */
        function sendMessageToClippy(data){
            console.log("Send Message");
            var xhr = new XMLHttpRequest();   // new HttpRequest instance 
            xhr.open("POST", clippyEndPoint + "/message");
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
            xhr.send(JSON.stringify(data));
            xhr.onreadystatechange = function(){
                if (xhr.readyState == 4 && xhr.status == 200) {
                        //handle the return

                    }
            }
        }
        /* sendHandMessage
            Socket emits message that will be sent via serial on the server side. 
            It can start the animation or whatever it needs to do
        */

        function sendHandMessage(){
            console.log("SendHandMessage");
            socket.emit('hand');
        }
        /**/
        function doAuthentication(){
           showSuccess();
        }

        // Pad string
        function PadLeft(string, pad, length) {
            return (new Array(length + 1).join(pad) + string).slice(-length);
        }

        // Start global timer
        function startTimer() {
            startTime = Date.now();
            setInterval(function() {
                var diff = Math.floor((Date.now() - startTime) / 1000);
                var timeLeft = TimeLimit - diff;
                var m = Math.floor(timeLeft / 60);
                var s = timeLeft - m * 60;
                $('#countdown-timer').html(PadLeft(m, '0', 2) + ":" + PadLeft(s, '0', 2));
            }, 1000); // Update ~ every second
        }

        function startTimeouts() {
            setTimeout(function() {
                if (halBeeper)
                    clearInterval(halBeeper);

                return transition($("#halscreen"), $("#loadscreen"), LoadTransitionTime, startupAudio, function() {
                    return setTimeout(function() { 
                        return transition($("#loadscreen"), $("#loginscreen"), 1000, null, function() {
                            $("#win31screen").show();
                        }); 
                    }, 2000);
                });
            }, ClippyTimer)
        }

        function setCommandPrompt() {
            $(document).click(function() {
                $('#command').focus();    
            });

            $('#command').focus();

            $(document).keypress(function(event) {
                if (event.key === "Enter")
                {
                    event.preventDefault();
                    $("#command").attr("contenteditable","false");
                    $("#command").off();

                    console.log("Running command: " + $("#command").text());
                    processCommandPrompt($("#command").text());

                    $("#command").attr("id","command-completed");
                    $("#prompt").append(`<div id="prompt-input">C:\\><span contenteditable="true" id="command"></span></div>`)
                    
                    $("#command").on('keydown paste', function(event) {
                        var keypressed = event.keyCode;
                        if ( keypressed === 8 || keypressed === 27 || keypressed === 46  || (keypressed >= 35 && keypressed <= 40) ) {
                            return;
                        }
        
                        if ((keypressed >=65 && keypressed <= 90) || (keypressed >=48 && keypressed <= 57) || (keypressed >= 96 && keypressed <= 105)){
                            if ($(this).text().length >= PromptMaxLength)
                            {
                                event.preventDefault();
                            }
                            return;
                        }
                        
                        if (event.key === "Enter")
                        {
                            return;
                        }
        
                        return event.preventDefault();
                    });

                    while ($('#prompt div').length > PromptMaxLines) {
                        $('#prompt').find('div').first().remove();
                    }
                    
                    $('#command').focus();
                }
            });

            $("#command").on('keydown paste', function(event) {
                var keypressed = event.keyCode;
                if ( keypressed === 8 || keypressed === 27 || keypressed === 46  || (keypressed >= 35 && keypressed <= 40) ) {
                    return;
                }

                if ((keypressed >=65 && keypressed <= 90) || (keypressed >=48 && keypressed <= 57) || (keypressed >= 96 && keypressed <= 105) 
                    || keypressed == 32
                    || keypressed == 189
                    || keypressed == 187){
                    if ($(this).text().length >= PromptMaxLength)
                    {
                        event.preventDefault();
                    }
                    return;
                }

                if (event.key === "Enter")
                {
                    return;
                }

                return event.preventDefault();
            });
        }

        function processCommandPrompt(command) {
            if (command === "help") {
                $("#prompt").append("<div>Commands available:</div>");
                $("#prompt").append("<div><br></div>");
                $("#prompt").append("<div>&emsp;&emsp;&emsp;&emsp;help</div>");
                $("#prompt").append("<div>&emsp;&emsp;&emsp;&emsp;info</div>");
                $("#prompt").append("<div>&emsp;&emsp;&emsp;&emsp;me</div>");
                $("#prompt").append("<div>&emsp;&emsp;&emsp;&emsp;shutdown</div>");
                $("#prompt").append("<div><br></div>");
            }
        }

        function startAnimations() {
            if (!DEBUG_MODE) {
                halBeeper = setInterval(function(){
                    halBeepAudio.play();
               }, HalBeepingRate);
            }
            
            var dotsCounter = 0;

            setInterval(function() {
                $("#dots").text("Calling" + ".".repeat(dotsCounter));
                dotsCounter++;
                if (dotsCounter > 10) 
                    dotsCounter = 0;
            }, 700);
        }
});
