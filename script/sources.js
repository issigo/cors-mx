
<script>
function file_get_contents(filename,nombre,contador) {
//fetch('https://corsproxy.io/?url='+filename).then((resp) => resp.text()).then(function(data) {

fetch(filename).then((resp) => resp.text()).then(function(data) {


var str = data;
//var iframe = str.search("IFRAME SRC=");
//var frameborder= str.search("FRAMEBORDER=0");
var iframe = str.search("sources:");
var frameborder= str.search("/v.mp4");

var https1=data.substr(iframe+11, frameborder-iframe-5);//15+8
console.log(filename+' '+https1);

});
}//fin get content

var nombre = ['s132nxdr57i2'];

var arreglo = ['https://uqload.net/embed-'];

//102
for(var a=0;a<1;a++){
file_get_contents(arreglo[a]+nombre[a]+'.html',nombre[a],a);}

</script>
