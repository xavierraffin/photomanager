class BaseStats {

  constructor() {
    this.photos = 0;
    this.with_exif = 0;
    this.without_exif = 0;
  }

  /*
   * These two functions are static because of the JSON loading who do not reload base class methods
   */
  static increment(instance, hasexif){
    if(hasexif) instance.with_exif++;
    else instance.without_exif++;
    instance.photos++;
  }
  static displayStats(instance)  {
    return instance.photos + " (exif:" + instance.with_exif + " noexif:" + instance.without_exif + ")";
  }
}

class GlobalStats extends BaseStats {

  constructor(){
    super();
    this.byYear = {};
  }

  increment(photoDate, hasexif){
    // Increment base
    BaseStats.increment(this, hasexif);
    // Increment specific year
    var year = photoDate.getFullYear();
    if(typeof this.byYear[year] === 'undefined') {
      this.byYear[year] = new BaseStats();
    }
    BaseStats.increment(this.byYear[year], hasexif);
  }

  displayStats(){
    console.log("TOTAL: %s", BaseStats.displayStats(this));
    for (var year in this.byYear) {
      // check if the property/key is defined in the object itself, not in parent
      if (this.byYear.hasOwnProperty(year)) {
        console.log(" - %s : %s ", year, BaseStats.displayStats(this.byYear[year]));
      }
    }
  }
}
exports.GlobalStats = GlobalStats;

exports.ImportStats = class ImportStats extends GlobalStats {
  constructor(){
    super();
    this.duplicates = 0;
  }

  displayStats(){
    console.log("Duplicates photos: %s", this.duplicates);
    super.displayStats();
  }
}
