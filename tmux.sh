mkdir ~/.teamocil
which teamocil || gem install teamocil
rm ~/.teamocil/fsbc.yml
ln -s $(pwd)/fsbc.yml ~/.teamocil/fsbc.yml
cat ~/.teamocil/fsbc.yml
teamocil fsbc