function takeScreenshot( document, window, camera, renderer, scene, resolution ) {
    const width = resolution * window.innerWidth
    const height = resolution * window.innerHeight
    // set camera and renderer to desired screenshot dimension
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(  width, height );

    renderer.render( scene, camera, null, false );

    const dataURL = renderer.domElement.toDataURL( 'image/png' );

    // save
    saveDataURI(document, window, defaultFileName( '.png' ), dataURL);

    // reset to old dimensions (cheat version)
    onWindowResize(window, camera, renderer);
}

function dataURIToBlob( window, dataURI ) {
    const binStr = window.atob( dataURI.split( ',' )[1] );
    const len = binStr.length;
    const arr = new Uint8Array( len );
    for ( let i = 0; i < len; i++ ) {
      arr[i] = binStr.charCodeAt( i );
    }
    return new window.Blob( [arr] );
  }


function saveDataURI( document, window, name, dataURI ) {
    const blob = dataURIToBlob( window, dataURI );

    // force download
    const link = document.createElement( 'a' );
    link.download = name;
    link.href = window.URL.createObjectURL( blob );
    link.onclick = () => {
      window.setTimeout( () => {
        window.URL.revokeObjectURL( blob );
        link.removeAttribute( 'href' );
      }, 500 );

    };
    link.click();
}

function defaultFileName (ext) {
    const str = `${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}${ext}`;
    return str.replace(/\//g, '-').replace(/:/g, '.');
}

function onWindowResize(window, camera, renderer) {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}