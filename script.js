


   document.addEventListener('keydown', function(e) {
      const audio = document.querySelector(`audio[data-key="${e.key}"]`);
      const key = document.querySelector(`.key[data-key="${e.key}"]`);
      
      if(!audio) return; //stop the function from running
      audio.currentTime = 0; //rewind to the start
      audio.play();
     key.classList.add('test');
   
    });
 
    function removeTransition(e){
        if(e.propertyName !== 'transform') return; // skip it if its not a transform
        this.classList.remove('test');
    }

    const keys = document.querySelectorAll('.key');
    keys.forEach(key => key.addEventListener('transitionend', removeTransition));
      