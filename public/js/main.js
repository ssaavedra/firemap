var map, heat

var data = {
  sender: null,
  timestamp: null,
  latlng: null
}

function initMap() {
  map = L.map('map').setView([42.654, -8.808], 8)

  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map)

  map.on('click', function(e) {
    var popup = L.popup()
	.setLatLng(e.latlng)
	.setContent('<a href="javascript:confirmAdd(' + escape(JSON.stringify(e.latlng)) + ')">Confirm add fire to map</a>')
	.openOn(map)
  })

  heat = L.heatLayer([], {minOpacity: 0, radius: 50, blur: 0}).addTo(map)

  initAuthentication(initFirebase.bind(undefined, map))

}

function confirmAdd(latlng) {
  console.log("Lat lng", latlng, heat)
  drawCircle(map, {latlng: latlng})
  data.latlng = latlng
  addToFirebase(data)

}

function drawCircle(map, pos) {
  // TODO change with time
  return L.circle(pos.latlng, {
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 250
  }).addTo(map)
}

function initAuthentication(onAuthSuccess) {
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(function() {
      return firebase.auth().signInAnonymously()
    }).catch(function(error) {
    console.log("Login failed!", error)
    }).then(function(user) {
      if(user) {
	data.sender = user.uid
	onAuthSuccess()
      } else {
	console.log("Logout!")
      }
    })
}

function initFirebase(map) {
  // Latest four hours
  var startTime = new Date().getTime() - (4 * 60 * 60 * 1000)

  // reference to the clicks in Firebase
  var clicks = firebase.database().ref().child('clicks')

  clicks.orderByChild('timestamp')
    .startAt(startTime).on('child_added', function(snapshot) {
      var newPosition = snapshot.val()
      var elapsed = new Date().getTime() - newPosition.timestamp

      console.log("Drawing position", snapshot, newPosition)

      drawCircle(map, newPosition)

      // // Requests entries older than expiry time (4 * 60 minutes).
      // var expirySeconds = Math.max(60 * 4 * 60 * 1000 - elapsed, 0);
      // // Set client timeout to remove the point after a certain time.
      // window.setTimeout(function() {
      // 	// Delete the old point from the database.
      // 	snapshot.ref().remove();
      // }, expirySeconds);
    })

  clicks.on('child_removed', function(snapshot, prevChildKey) {
    var heatmapData = heatmap.getData();
    var i = 0;
    while (snapshot.val().lat != heatmapData.getAt(i).lat()
           || snapshot.val().lng != heatmapData.getAt(i).lng()) {
      i++;
    }
    heatmapData.removeAt(i);
  });

}

/**
 * Updates the last_message/ path with the current timestamp.
 * @param {function(Date)} addClick After the last message timestamp has been updated,
 *     this function is called with the current timestamp to add the
 *     click to the firebase.
 */
function getTimestamp(addClick) {
  // Reference to location for saving the last click time.
  var ref = firebase.database().ref('last_message/' + data.sender);

  ref.onDisconnect().remove();  // Delete reference from firebase on disconnect.

  // Set value to timestamp.
  ref.set(firebase.database.ServerValue.TIMESTAMP, function(err) {
    if (err) {  // Write to last message was unsuccessful.
      console.log(err);
    } else {  // Write to last message was successful.
      ref.once('value', function(snap) {
        addClick(snap.val());  // Add click with same timestamp.
      }, function(err) {
        console.warn(err);
      });
    }
  });
}

/**
 * Adds a click to firebase.
 * @param {Object} data The data to be added to firebase.
 *     It contains the lat, lng, sender and timestamp.
 */
function addToFirebase(data) {
  getTimestamp(function(timestamp) {
    // Add the new timestamp to the record data.
    data.timestamp = timestamp;
    var ref = firebase.database().ref().child('clicks').push(data, function(err) {
      if (err) {  // Data was not written to firebase.
        console.warn(err);
      }
    });
  });
}

