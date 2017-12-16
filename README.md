# PhotoManager introduction

PhotoManager is a simple personal photo manager for your desktop. (Windows/Mac/Linux)

## Development commands

Installation:
```
git clone git@github.com:xavierraffin/photomanager.git
cd
npm Install
```

To start electron listening http://localhost:3000 :
```npm run dev```

To start only react on http://localhost:3000 :

```npm start```

Build electron app from production with static assets:

```npm run build```

If foreman process is still listen 3000 and you want to kill it:
On Mac:
```lsof -n -i:3000 | grep LISTEN```

## Hall of fame

Thanks to [csepulv](https://github.com/csepulv) for inspiring setup from https://github.com/csepulv/electron-with-create-react-app
