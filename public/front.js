let token
$(document).ready(function(){
    $("#Login").click(() => {
        const username = $("#UsernameInput").val()
        const password = $("#PasswordInput").val()
        console.log(username, password)
        $.post("/login", { username: username, password: password }).done((result,status) => {
            console.log(status, result)
            token = result.token
            console.log(token)
            $('#Login-containers').hide(500)
            $('#Buttons').show(500)
            if(result.lvl === 1)
                $('#Command').show(500)
            $('#Output').show(500)
        }).catch(err=>{
            console.log(err)
        })
    })
    $("#Restart").click(() => {
        $.post("/restart", { token }).done((result,status) => {
            if (result.out === '' && result.err === ''){
                $('#stdout').html("<p>Successful</p>")
                $('#stderr').html("<p></p>")
            }
            const ro = result.out.replaceAll('<', '&lt').replaceAll('>','&gt').replaceAll('\n\r', '</p><p>').replaceAll('\n', '</p><p>')
            const re = result.err.replaceAll('<', '&lt').replaceAll('>','&gt').replaceAll('\n\r', '</p><p>').replaceAll('\n', '</p><p>')
            $('#stdout').html("<p>"+ro+"</p>")
            $('#stderr').html("<p>"+re+"</p>")
        }).catch(err=>{
            console.log(err.responseText)
            const re = err.responseText.replaceAll('<', '&lt').replaceAll('>','&gt').replaceAll('\n\r', '</p><p>').replaceAll('\n', '</p><p>')
            $('#stderr').html("<p>"+re+"</p>")
        })
    })
    $("#Run").click(() => {
        const cmd = $("#CommandInput").val()
        console.log(cmd)
        $.post("/run", { token , cmd }).done((result,status) => {
            const ro = result.out.replaceAll('<', '&lt').replaceAll('>','&gt').replaceAll('\n\r', '</p><p>').replaceAll('\n', '</p><p>')
            const re = result.err.replaceAll('<', '&lt').replaceAll('>','&gt').replaceAll('\n\r', '</p><p>').replaceAll('\n', '</p><p>')
            $('#stdout').html("<p>"+ro+"</p>")
            $('#stderr').html("<p>"+re+"</p>")
        }).catch(err=>{
            console.log(err.responseText)
            const re = err.responseText.replaceAll('<', '&lt').replaceAll('>','&gt').replaceAll('\n\r', '</p><p>').replaceAll('\n', '</p><p>')
            $('#stdout').html("<p></p>")
            $('#stderr').html("<p>"+re+"</p>")
        })
    })
});