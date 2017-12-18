import React, { Component } from 'react';
import { Grid, Row, Col } from 'react-bootstrap';
const { getIPCPhotoPath } = require('../model/Photo');
const { Logger, LOG_LEVEL } = require('../utils/Logger');
var logger = new Logger(LOG_LEVEL.DEBUG);
import './PhotoExplorer.css';

class PhotoExplorer extends Component {
  constructor(props){
    super(props);
    logger.log(LOG_LEVEL.DEBUG,"PhotoExplorer constructor value = %s", props.value);
    this.state = { storage : props.value };
  }

  createRow(photo, dir) {

    var divStyle = { backgroundImage: 'url(' + dir + getIPCPhotoPath(photo.n) + ')'}
      logger.log(LOG_LEVEL.DEBUG, "style cell= %s : %s",divStyle.backgroundImage, getIPCPhotoPath(photo.n));
    return (
      <Col className="photoBox" style={divStyle} xs={12} sm={6} md={3} lg={2}>
        <div>
        </div>
      </Col>
    )
  }

  render() {
    var cells = [];
    logger.log(LOG_LEVEL.DEBUG,"render PhotoExplorer");
    logger.log(LOG_LEVEL.DEBUG,"value = %s", this.props.value);
    if(this.props.value !== null) {
      logger.log(LOG_LEVEL.DEBUG,"Add cells  0 = %s", this.props.value.chunck[0].w);
      logger.log(LOG_LEVEL.DEBUG,"Add cells = %s", this.props.value.chunck.length);
      for (var i = 0; i < this.props.value.chunck.length; i++) {
        logger.log(LOG_LEVEL.DEBUG," cells = %s", this.props.value.chunck[i].w);
        cells[i] = this.createRow(this.props.value.chunck[i], this.props.value.dir);
      }
    }
    return (
      <Grid bsClass="photoGrid">
        <Row bsClass="reset">
          {cells}
        </Row>
      </Grid>
    );
  }
}

export default PhotoExplorer;
