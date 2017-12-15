
exports.formatDate = function(d) {
  var dateStr = [d.getDate(),
                         d.getMonth()+1,
                         d.getFullYear()].join('/')+'_'+
                        [d.getHours(),
                         d.getMinutes(),
                         d.getSeconds()].join(':');
  return dateStr;
}

exports.formatDateSafe = function(d)  {
  var dateStr = [d.getFullYear(),
                         d.getMonth()+1,
                         d.getDate()].join('-')+'_'+
                        [d.getHours(),
                         d.getMinutes(),
                         d.getSeconds()].join('-');
  return dateStr;
}

exports.datefromSafeFormat = function(str) {
  return dateFromStr(str, "_", "-");
}

exports.dateFromExif = function(exifDate) {
  return dateFromStr(exifDate, " ", ":");
}

function dateFromStr(str, majorSeparator, minorSeparator) {
  var DateTime = str.split(majorSeparator);
  var dateParts = DateTime[0].split(minorSeparator);
  var timeParts = DateTime[1].split(minorSeparator);
  return new Date( Number(dateParts[0]),
                   Number(dateParts[1]) - 1,
                   Number(dateParts[2]),
                   Number(timeParts[0]),
                   Number(timeParts[1]),
                   Number(timeParts[2]));
}
