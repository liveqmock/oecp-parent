Ext.ns("OECP.ui");
/** 重载 jsonreader 方法，修正 store内定义的'xxxx.xxx'类型字段取值时，父级属性为空时抛异常
 * 使用try函数尝试获取数据，如果没有则返回空字符串，防止报错影响js调用。
 */
Ext.data.JsonReader.prototype.createAccessor=function(){
        var re = /[\[\.]/;
        return function(expr) {
            if(Ext.isEmpty(expr)){
                return Ext.emptyFn;
            }
            if(Ext.isFunction(expr)){
                return expr;
            }
            var i = String(expr).search(re);
            if(i >= 0){
                return new Function('obj', 'var err=false; try{obj'+(i>0?'.':'')+expr+';}catch(e){err=true;}  if(!err) return obj' + (i > 0 ? '.' : '') + expr+'; else return "";');
            }
            return function(obj){
                return obj[expr];
            };

        };
    }();
/**
 * 重载日期转换方法，修正ajax提交的日期和时间之间带‘T’的问题。
 */
Ext.util.JSON.encodeDate = function(d) {
    return d.format('"Y-m-d h:i:s.S"');
};
/**
 * 重载日期控件转换函数,对无法转换的时间格式用'Y-m-d h:i:s'格式再处理
 * @param {} value
 * @return {}
 */
Ext.form.DateField.prototype.parseDate = function(value) {
    if(!value || Ext.isDate(value)){
        return value;
    }
    var v = this.safeParse(value, this.format),
        af = this.altFormats,
        afa = this.altFormatsArray;

   	if(!v){
   		 v = this.safeParse(value, "Y-m-d h:i:s");
   	}
   	if(!v){
   		 v = this.safeParse(value, "Y-m-dTh:i:s");
   	}
    if (!v && af) {
        afa = afa || af.split("|");
        for (var i = 0, len = afa.length; i < len && !v; i++) {
            v = this.safeParse(value, afa[i]);
        }
    }
    return v;
};
/**
 * 重载赋值，用于解决带分页的自定义combo首次加载时显示值丢失问题
 * @param {} values
 */
Ext.form.BasicForm.prototype.setValues=function(values){
	if (Ext.isArray(values)) {
		for (var i = 0, len = values.length; i < len; i++) {
			var v = values[i];
			var f = this.findField(v.id);
			if (f) {
				if (Ext.isFunction(f.setValueEx) && f.displayField) {
					var varg = v.value.split('.');
					varg[varg.length - 1] = f.displayField;
					var nid = varg.join('.');
					var nval = '';
					for (var j = 0; j < values.length; j++) {
						if (values[j].id === nid) {
							nval = values[j].value;
							break;
						}
					}
					f.setValueEx(v.value, nval);
				} else {
					f.setValue(v.value);
				}
				if (this.trackResetOnLoad) {
					f.originalValue = f.getValue();
				}
			}
		}
	} else {
		var field, id;
		for (id in values) {
			if (!Ext.isFunction(values[id]) && (field = this.findField(id))) {
				if (Ext.isFunction(field.setValueEx) && field.displayField) {
					var varg = id.split('.');
					varg[varg.length - 1] = field.displayField;
					field.setValueEx(values[id], values[varg.join(".")]);
				} else {
					field.setValue(values[id]);
				}
				if (this.trackResetOnLoad) {
					field.originalValue = field.getValue();
				}
			}
		}
	}
	return this;
};


/*******************************************************************************
 *						主子表卡片界面 	
 *******************************************************************************/
/**
 * 单据主从表 编辑界面 主要定义公共方法和属性
 * 
 * @class Ext.ui.BasicListBill
 * @extends Ext.panel
 */
OECP.ui.BasicListBill = Ext.extend(Ext.Panel, {
	baseCls:'',
	/** @cfg {String}			commitUrl			送审action地址*/
	/** @cfg {String}			auditUrl				审批action地址*/
	/** @cfg {String}			delUrl					删除action地址*/
	/** @cfg {String}			submitUrl				保存action地址 */
	/** @cfg {String} 			queryBillUrl 			单据查询url地址,用于查询子表数据 */
	/** @cfg {String} 			editUrl					加载一条数据action地址 }*/
	/** @cfg {String}			functionCode		功能编号*/
	// 实体配置信息
	/** @cfg {String} 			headEntityName		主表实体名 */
	/** @cfg {Array/String} 	bodyEntityName	    子表实体名 */
	/** @cfg {Array} 	        bodyMutilEntityName	多子表实体名 */
	/** @cfg {object}			queryBaseParams 	查询默认条件*/
	// 主要控件
	/** @cfg {GridPanel} 		headGrid 				主表Grid */
	/** @cfg {GridPanel} 		bodyGrid 				从表Grid */
	/** @cfg {JsonStore} 		headStore 			主表数据集 */
	/** @cfg {JsonStore/Array}	bodyStore 		子表数据集 */
	/** @cfg {Object} 			topItem 				顶部控件 */
	/** @cfg {Object} 			endItem 				底部控件 */
	/** @cfg {number}			headPageSize		列表分页的每页显示记录数 */
	/** @cfg {Array/Object}	quickQueryCfg		快速查询组件参数 */
	/** @cfg {FormPanel}		quickQueryPanel	快速查询面板 */
	headPageSize	: 25,
	/** @cfg {Number} 			billWinHeight		窗口高度 */	
	billWinHeight:510,
	/** @cfg {Number} 			billWinWidth			窗口宽度 */
	billWinWidth:950,
	/** @cfg {Object}				printTemplate 		打印模板,包括id、name、vtemplate三个属性*/
	layout:'fit',
	// 按钮
	/** @cfg {Ext.Button} 		queryBtn 		查询按钮 */
	/** @cfg {Ext.Button} 		addBtn 		    增加按钮 */
	/** @cfg {Ext.Button} 		editBtn 		编辑按钮 */
	/** @cfg {Ext.Button} 		delBtn 			删除按钮 */
	/** @cfg {boolean} 			billFlowFlag 	是否包含业务流 */
	//权限按钮
	btnPermission : [],
	/** @cfg {Array} 				btnBar 							按钮条 按钮属性,除增删改查等按钮外,初始化时可追加自定义按钮 */
	// 复杂查询面板 
	/** @cfg {OECP.ui.QueryWindow} queryWindow	查询面板 */
	/**  @cfg {Object} 			headStoreParams 		表头默认查询参数 <br>
	 * 
	 * <pre><code>
	 * {id:'abc',code:'xxx'}
	 * </code></pre>
	 */
	/** @cfg {Array} 				bodyStoreFields 			从表数据字段 */
	/** @cfg {Object} 			refs 								字段参照  */
	/** @cfg {String}				billinfo							单据编号	*/
	/** @cfg {String} 				headPrimaryKey 			主表主键字段名,用于主表行点击后从表数据联动时，传递参数取值 */
	headPrimaryKey : 'id',
	/** @cfg {String}				headCurrentPK				表头中选中行的主键 (行点击后获取,并不是勾选框勾选的主键)*/
	headCurrentPK : '',
	frame:false,border:false,
	// 查询按钮
	querybtn_cfg : {
			xtype : 'querybtn',
			keyBinding:{key:'q',alt:true},showHotKey:true,
			text : '查询',
			listeners : {
				'click' : function() {
					var querydata = me.quickQueryPanel.getForm().getValues();
					me.doQuery(querydata);
				}
			}
		},
	initComponent : function() {
		var pp = {limit:this.headPageSize,start:0};
		if(this.headStoreParams){//追加分页参数。用于默认查询使用
			this.headStoreParams=Ext.applyIf(pp,this.headStoreParams);
		}else{
			this.headStoreParams=pp;
		}
		this.addEvents('uiloaded');
//		this.initQuickQuery();
		this.initBtnbar();//初始化按钮
		this.buttonToAccess();//按钮权限
		OECP.ui.BasicListBill.superclass.initComponent.call(this);
		this.autoFill();
	},
	uiReady :{queryui:false,listui:false},
	setUIReady :function(uiname){
	    this.uiReady[uiname] = true;
	    if(this.uiReady.queryui===true && this.uiReady.listui===true){
		this.fireEvent('uiloaded',this);
	    }
	},
	// ****** 自适应全屏 begin ****** //
	autoFill : function(){
	        Ext.EventManager.onWindowResize(this.windowResize, this);
	},
	windowResize : function(w, h){
	        this.onResize(w, h, w, h);
	},
	// ****** 自适应全屏 e n d ****** //
	
	//privet 初始化新增/编辑窗体
	initBillWin:function(){
		var master = this;
		if(this.billwin){this.billwin.destroy();};
		this.billwin = new OECP.ui.BasicCardWin({
			transmit:function(){//传递参数,把listpanel里的子表store传递到window内
				var scope = this;
				if(master.bodyEntityName && Ext.isString(master.bodyEntityName)){
					scope[master.bodyEntityName+'_cardstore_cfg'] = me[master.bodyEntityName+'_cardstore_cfg'];
				}else if(master.bodyEntityName && Ext.isArray(master.bodyEntityName)){
					for(var i=0;i<master.bodyEntityName.length;i++){
						scope[master.bodyEntityName[i]+'_cardstore_cfg'] = me[master.bodyEntityName[i]+'_cardstore_cfg'];
					}
				}
			},
			modal:true,
			closeAction:'hide',
			functionCode:master.functionCode,
			height:master.billWinHeight,
			width:master.billWinWidth,
			formView:master.formView,
			submitUrl:master.submitUrl||'',
			queryBillUrl:master.queryBillUrl||'',
			headEntityName:master.headEntityName||'',
			bodyEntityName:me.bodyEntityName||'',
			bodyMutilEntityName:me.bodyMutilEntityName||''
		});
		this.billwin.bill.on('submitsuccess',function(response, opts, scope){
			//业务制单
			if(me.bussinessAddflag){
				var r = me.getHeadGrid().store.getById(me.selectRecordId);
				master.getHeadGrid().store.remove(r);
			}else{
			//TODO  保存后事件未作
				//hd = this.billwin.bill.getValues();
				//业务制单
					//如果是增加 不处理
					//如果是编辑 更新状态
				//手工制单
					//如果是新增 插入数据
					//如果是修改 更新原始数据
			}
			var msg = eval("("+Ext.util.Format.trim(response.responseText)+")");
			if(msg.success){
				Ext.ux.Toast.msg('信息',	"保存成功！");
			} else {
				Ext.Msg.show({title:"错误",msg:msg.msg,buttons:Ext.Msg.OK});
			}
		});
		if(this.viewWin){this.viewWin.destroy();};
		this.viewWin = new OECP.ui.BasicCardWin({
			transmit:function(){//传递参数,把listpanel里的子表store传递到window内
				var scope = this;
				if(master.bodyEntityName && Ext.isString(master.bodyEntityName)){
					scope[master.bodyEntityName+'_cardstore_cfg'] = me[master.bodyEntityName+'_cardstore_cfg'];
				}else if(master.bodyEntityName && Ext.isArray(master.bodyEntityName)){
					for(var i=0;i<master.bodyEntityName.length;i++){
						scope[master.bodyEntityName[i]+'_cardstore_cfg'] = me[master.bodyEntityName[i]+'_cardstore_cfg'];
					}
				}
			},
			modal:true,
			closeAction:'hide',
			functionCode:master.functionCode,
			height:master.billWinHeight,
			width:master.billWinWidth,
			formView:master.formView,
			submitUrl:master.submitUrl||'',
			queryBillUrl:master.queryBillUrl||'',
			headEntityName:master.headEntityName||'',
			bodyEntityName:me.bodyEntityName||'',
			bodyMutilEntityName:me.bodyMutilEntityName||''
		});
		
	},
	// private 初始化按钮
	initBtnbar : function() {
		var me = this,btns=[];
		this.queryBtn = new OECP.ui.button.QueryButton();
		this.addBtn = new OECP.ui.button.AddButton();
		this.editBtn = new OECP.ui.button.EditButton({useable:{single:true,BPMING:false,EFFECTIVE:false,INVALID:false}});
		this.delBtn = new OECP.ui.button.DelButton({useable:{single:false,BPMING:false,EFFECTIVE:false,INVALID:false}});
		this.printBtn = new Ext.SplitButton({
			text : '打印',
			single:false,
			handler:function(){
				me.doPrint("PRINT");
			},
			menu : {
						xtype : 'menu',
						items : [{
									text : '打印预览',
									single:false,
									keyBinding:{key:'v',ctrl:true,alt:true},showHotKey:true,
									handler : function() {
										me.doPrint("PREVIEW");
									}
								}, {
									text : '打印维护',
									keyBinding:{key:'w',ctrl:true,alt:true},showHotKey:true,
									handler:function(){
										me.doPrint("PRINT_SETUP");
									}
								}, {
									text : '模板选择',
									keyBinding:{key:'x',ctrl:true,alt:true},showHotKey:true,
									menu : {}
								}]
					}
		});
		this.viewBPMButton = {text: '查看流程状态',useable:{single:true,TEMPORARY:false},keyBinding:{key:'s',ctrl:true,alt:true},showHotKey:true,handler:function(){me.doViewBPM.call(me);}};
		this.commitButton = {text:'提交审批',useable:{single:true,BPMING:false,EFFECTIVE:false,INVALID:false},keyBinding:{key:'c',ctrl:true,alt:true},showHotKey:true,handler:function(){me.doCommit.call(me);}};
		this.auditButton = {text: '审批',useable:{single:true,EDIT:false,EFFECTIVE:false,INVALID:false,TEMPORARY:false},keyBinding:{key:'a',ctrl:true,alt:true},showHotKey:true,handler:function(){me.doAudit.call(me);}};
		this.preBillButton = {text: '查看上游单据',useable:{single:true,TEMPORARY:false},keyBinding:{key:'9',ctrl:true,alt:true},showHotKey:true,handler:function(){me.doPrebill.call(me);}};
		this.nextBillButton = {text: '查看下游单据',useable:{single:true,EDIT:false,BPMING:false,INVALID:false,TEMPORARY:false},keyBinding:{key:'0',ctrl:true,alt:true},showHotKey:true,handler:function(){me.doNextBill.call(me);}};
		this.auditProcessMenu = new Ext.menu.Menu({
			useable:{single:true,TEMPORARY:false},
	        style: {overflow: 'visible'},
	        items:[this.viewBPMButton,this.commitButton,this.auditButton]
	    });
		 this.billProcessMenu = new Ext.menu.Menu({
			useable:{single:true,TEMPORARY:false},
	        style: {overflow: 'visible'},
	        items:[this.preBillButton,this.nextBillButton]
	    });
		this.initButtonEvent();
		//界面视图选择器
		if(!this.loader){
			this.loader = new OECP.uiview.Loader({
				functionCode:me.functionCode,
				flushListView:function(config){
					var json = Ext.decode(config);
					var _view=json.result;
					var pagewidth = document.body.clientWidth;
					Ext.apply(_view,{region:'center',baseCls:'',width:pagewidth});
					var addPageBarFlag = false;//是否追加分页标记
					var forEachsetWidthFun = function(_items){//递归设置 oecpgrid控件宽度
						if(Ext.isDefined(_items) && Ext.isArray(_items)){
							Ext.each(_items,function(i){forEachsetWidthFun(i);},this);
						}else if(Ext.isDefined(_items) && Ext.isObject(_items)){
							if(['oecpgrid','oecpeditgrid'].indexOf(_items.xtype) !== -1){
								_items.width = pagewidth;
								if(!addPageBarFlag){//为第一个表格默认追加分页控件
									_items.bbar = new Ext.PagingToolbar({
										displayInfo:true,pageSize:me.headPageSize,store:{},
										displayMsg:'当前页记录索引{0}-{1}， 共{2}条记录',
										emptyMsg:'当前没有记录'
									});
									addPageBarFlag=true;
								}
							}
							if(Ext.isDefined(_items.items)){
								forEachsetWidthFun(_items.items);}
						}
					};
					forEachsetWidthFun(_view);
					me.removeAll();
					me.clearBillProperty.call(me);//清理内部变量
					
					me.mainPanel = new Ext.Panel({layout:'border',frame:false,border:false,defaults:{border:false}});//面板，容纳查询和视图模板
					me.mainPanel.add(_view);//
					me.add(me.mainPanel);//
					me.initBillProperty.call(me);
					//me.doLayout();
					//me.initQueryWin.call(me);//初始化查询框
					me.loadQueryScheme(this.getValue());
					me.initSuccessCallback.call(me);
					me.initPrintTemplateMenu(this.getValue());
					me.changeButtonState();
					me.setUIReady('listui');
				},
				flushFormView:function(config){
					me.formView = config;
					me.initBillWin();//初始化编辑界面
				}
			});
		}
		btns = this.initBillFlowBtn();
		if(!this.modelFlag){
			btns.push([{text:'审批流程',useable:{single:true},menu: this.auditProcessMenu},{text:'单据流程',useable:{single:true},menu:this.billProcessMenu}]);
		}
		if (this.btnBar && this.btnBar.length > 0) {btns.push(this.btnBar);}
		this.tbar = new Ext.Toolbar({bodyStyle : 'text-align:left',plugins:new Ext.ux.ToolbarKeyMap(),items : btns});
	},
	loadDatas:function(datas){
	    this.getHeadGrid().store.loadData(datas);
	},
	loadQueryScheme : function(viewId){
		// 加载查询方案
		Ext.Ajax.request({
			params : {viewId : viewId},
			url : __ctxPath + "/funview/getQS.do",
			success:function(response, opts){
				var obj = Ext.decode(response.responseText);
				if(obj.success){
					me.queryScheme = obj.result;
				}else{
					me.queryScheme = null;
				}
				me.initQueryWin.call(me);//初始化查询框
				me.initQueryPanel.call(me);//初始化常用查询面板
				me.doLayout();
				me.setUIReady('queryui');
			}, 
			failure: function(response, opts) {
				me.queryScheme = null;
				me.initQueryWin.call(me);//初始化查询框
				me.initQueryPanel.call(me);//初始化常用查询面板
				me.doLayout();
				me.setUIReady('queryui');
			}
		});
	},
	//private 初始化打印
	initPrintTemplateMenu :function(viewId){
		var me = this;
		//加载打印模板Menu
		Ext.Ajax.request({
			params : {viewId : viewId},
			url : __ctxPath + "/funview/checkedPrintTemplate.do",
			success:function(response, opts){
				var obj = Ext.decode(response.responseText);
				var _t_menu = me.printBtn.menu.items.get(me.printBtn.menu.items.length-1);
				if(Ext.isDefined(_t_menu.menu.items) && _t_menu.menu.items.length>0){//清空打印模板菜单
					for(var i = _t_menu.menu.items.length;i >0; i--){
						_t_menu.menu.items.remove(i-1);
					}
				}
				if(obj.success){
					var _templates =obj.result;
					if(!Ext.isEmpty(_templates)){
						for(var i=0; i< obj.result.length; i++){
							if(i==0){me.printTemplate={id:_templates[i].id} /*模板默认选择第一个加载*/}
							_t_menu.menu.add({//追加模板列表
												text : _templates[i].name,
												value : _templates[i].id,
												checked : i == 0 ? true : false,
												group : 'printtemplate',
												handler : function(btn) {
													me.printTemplate = {id:btn.value};//模板体积较大，只记录id，使用时加载
												}
											});
						}
					}
				} else {	/*Ext.ux.Toast.msg("信息", '打印模板加载失败！请联系管理员。');*/	}
			}, failure: function(response, opts) {/*Ext.ux.Toast.msg("信息", '打印模板加载失败！请联系管理员。');*/  }
		});
	},
	/*private 加载打印模板*/
	loadPrintTemplate:function(templateId,callbackFun){
		var me = this;
		Ext.Ajax.request({
			url : __ctxPath + "/funview/getPrintTemplate.do",
			params : {printTemplateIds : templateId},
			success:function(response,opt){
				var obj = Ext.decode(response.responseText);
				if(obj.success){
					me.printTemplate = obj.result;
					if(Ext.isDefined(callbackFun) && Ext.isFunction(callbackFun)){
						callbackFun.call(me);
					}
				}
			},
			failure: function(response, opts) {/*Ext.ux.Toast.msg("信息", '打印模板加载失败！请联系管理员。');*/}
		});
	},
	/**
	 * @function doPrint 打印
	 * @param {} ptype 打印类型 默认为"预览"
	 */
	doPrint :function(printAction){
		var me = this,_p = me.printTemplate;
		if(typeof LODOP === 'undefined'){
			LODOP = getLodop(document.getElementById('LODOP_OB'),document.getElementById('LODOP_EM'));
		}
		var loadData = function(){
			Ext.Ajax.request({
				url : me.queryBillUrl,
				params: Ext.apply(me.queryBaseParams||{},{id:me.headCurrentPK}),
				success: function(response, opts) {
					var json = Ext.decode(response.responseText);
					if(json.success){
						try{
							var _xtemplate = new Ext.XTemplate(me.printTemplate.vtemplate);
							var _printbat = _xtemplate.applyTemplate(json.result);
							eval(_printbat);	
							LODOP[printAction]();
						}catch(e){
							Ext.ux.Toast.msg("信息", '打印模板加载失败！请联系管理员。\n错误信息：'+e);
						}
					}
			   },
			   failure: function(response, opts) {
			   }
			})
		}
		if(Ext.isDefined(_p) && Ext.isDefined(_p.id)){
			if(!Ext.isDefined(_p.vtemplate)){
				me.loadPrintTemplate(_p.id,loadData);
			}else{
				loadData();
			}
		}else{
			Ext.ux.Toast.msg("信息", '打印模板加载失败！请联系管理员。');
		}
	},
	//private 初始化快速查询
	initQuickQuery:function(){
		var me = this;
		if(!Ext.isEmpty(me.quickQueryCfg)){
			me.quickQueryPanel=new Ext.form.FormPanel({//查询面板
				height:35,
				plugins:new Ext.ux.ToolbarKeyMap(),
				region:'north',layout:'border',frame:true,items:[
						{xtype:'panel',region:'center',layout:'column',items:[me.quickQueryCfg]},
						{xtype:'panel',region:'east',height:25,width:100,items:[me.querybtn_cfg]
						}
				]
			});
		}
	},
	initBillFlowBtn:function(){
		var me =scope= this;
		if(this.billFlowFlag){//增加业务类型选择
			var billFlowBizTypeStore = new Ext.data.JsonStore({
				url : __ctxPath+'/billflow/loadBizTypes.do' ,
				baseParams :{
					functionCode : me.functionCode
				},
				fields : ['id','name','description'],
				autoload:true
			});
			billFlowBizTypeStore.load();
			billFlowBizTypeStore.on("load",function(){
				  var firstValue = billFlowBizTypeStore.getAt(0).get('id');
				  me.bizTypeCombo.setValue(firstValue);//同时下拉框会将与name为firstValue值对应的 text显示
				  me.bizTypeCombo.fireEvent('select',me.bizTypeCombo,billFlowBizTypeStore.getAt(0),0);
			});
			
			this.bizTypeCombo = new Ext.form.ComboBox({
				fieldLabel : "业务类型",
				store : billFlowBizTypeStore,
				displayField : 'name',
				valueField : "id",
				typeAhead : false,
				mode : 'local',
				triggerAction : 'all',
				selectOnFocus : true,
				allowBlank : true,
				editable:false,
				width : 120,
				listeners :{
					select : function(){
						var bizTypeId = me.bizTypeCombo.getValue();
						me.loader.bizTypeId = bizTypeId;
						me.loader.combo.store.baseParams['bizTypeId']=bizTypeId;
						//加载视图
						me.loader.combo.store.load();
						Ext.Ajax.request({
							url:__ctxPath + "/billflow/loadQueryDlgInfo.do",
							params:{
								bizTypeID:bizTypeId,
								functionCode:me.functionCode
							},
							success : function(h, data) {
								var data = eval("(" + h.responseText + ")");
								var byHand = data['byHand'];
								var byBussiness = data['byBussiness'];
								if(byHand && byBussiness){// 只有一种方式时，隐藏按钮
									me.rad.setVisible(true);
								}else{
									me.rad.setVisible(false);
								}
								if(byHand){
									me.rad.items.items[0].setVisible(true);
								}else
									me.rad.items.items[0].setVisible(false);
								if(byBussiness){
									me.rad.items.items[1].setVisible(true);
								}else
									me.rad.items.items[1].setVisible(false);
								
								if(me.rad.items.items[0].isVisible())
									me.rad.setValue("byHand");
								else if(me.rad.items.items[1].isVisible())
									me.rad.setValue("byBussiness");
							},
							failure : function(h, data) {
								alert(data.result);
							}
						});
				}	
			  }
			});
			
			this.rad = new Ext.form.RadioGroup({
				items: [{
	                boxLabel: '手动', 
	                name: 'addbill', 
	                inputValue: 'byHand'
                },{
	                boxLabel: '业务', 
	                name: 'addbill', 
	                inputValue: 'byBussiness'
                }
            ]
			});
			btns = [this.loader,new Ext.Toolbar.TextItem('业务类型：'),this.bizTypeCombo,this.rad,this.queryBtn, this.addBtn,this.editBtn, this.delBtn,this.printBtn];
		}else{
			//加载视图
			me.loader.combo.store.load();
			btns = [this.loader,this.queryBtn, this.addBtn, this.editBtn, this.delBtn,this.printBtn];
		}
		return btns;
	},
	//初始化按钮事件
	initButtonEvent:function(){
		var scope=me=this;
		this.addBtn.on('click',function(){
			scope.bussinessAddflag=false;
			if(!me.billwin)
				me.initBillWin.call(me);
			if(scope.billFlowFlag){//增加业务类型选择
				var radValue = "";
				scope.rad.eachItem(function(item){ 
					if(item.checked)
						radValue = item.inputValue;   
				});
				var bizTypeId = scope.bizTypeCombo.getValue();
				if(radValue=="byHand"){
					scope.initBillWin.call(scope);// 重新初始化窗体
					scope.billwin.bill.dataClear();
					var jsonData = Ext.util.JSON.decode('{"bizType":"'+bizTypeId+'"}');
					scope.billwin.bill.getForm().setValues(jsonData);
					scope.billwin.show();
				}else if(radValue=="byBussiness"){
					scope.addByBussiness(scope,bizTypeId,scope.functionCode);
				}
			}else{
			    this.billwin.show();
			    this.billwin.reset();
			}
		},this);
		this.delBtn.on('click',function(){
			var rows = this.getHeadGrid().getSelectionModel().getSelections();
			if (rows.length >= 1) {
				Ext.MessageBox.confirm("提示", "是否确认要删除",function(btn) {
					if (btn === 'yes') {
						if(Ext.isEmpty(rows[0].data.id) || rows[0].data.id ==='null'){
							me.getHeadGrid().getSelectionModel().each(function(r){
								me.getHeadGrid().store.remove(r);
							});
						}else{
							var ids =[];
							Ext.each(rows,function(r){
								ids.push(r.data.id);
							});
							Ext.Ajax.request({
								url : this.delUrl,
								params : {ids : ids,functionCode:me.functionCode},
								success : function(request) {
									var json = Ext.decode(request.responseText);
									if (json.success) {
										Ext.ux.Toast.msg('信息',	json.msg);
									} else {
										Ext.Msg.show({title:'错误',msg:json.msg,buttons:Ext.Msg.OK	});
									}
									scope.getHeadGrid().store.removeAll();
									scope.getHeadGrid().store.reload();
								},
								failure : function(request) {
									var json = Ext.decode(request.responseText);
									Ext.Msg.show({title:'错误',msg:json.msg,buttons:Ext.Msg.OK});
								}
							});
						}
					}
				}, this);
			} else {Ext.MessageBox.alert('错误', '请选择一条记录！');	}
		},this);
		this.editBtn.on('click',function(){
			var rows = this.getHeadGrid().getSelectionModel().getSelections();
			if (rows.length == 1) {
			    if(!me.billwin)
				me.initBillWin.call(me);// 重新初始化窗体
                // 显示停用按钮
			    if(scope.stopControl)
			      me.billwin.setStopable(scope.stopControl(rows[0].data));
				if(Ext.isEmpty(me.headCurrentPK,false) || me.headCurrentPK ==='null'){
					scope.billwin.reset();
					me.bussinessAddflag=true;
					scope.getHeadGrid().getSelectionModel().each(function(_record){
						scope.selectRecordId = _record.id;
						var data = _record.data;
						// data['id'] = '';
						scope.billwin.bill.setValues(data);
						scope.billwin.show();	
					});
				}else{
					me.bussinessAddflag=false;
					this.billwin.doQuery({
						url:me.editUrl,
						params:{id:me.headCurrentPK,functionCode:me.functionCode},
						success:function(request){
							var json = Ext.decode(request.responseText);
							if (json.success) {
							    if(me.billwin.bill.initComplete){//判断界面是否加载完成
        							// me.billwin.setEditable(true);
        						    }else{
        							me.billwin.bill.viewEditable=false;
        						    }
							    me.billwin.show();
							    me.billwin.reset();
							    me.billwin.bill.setValues(json.result);// 赋值
							    
							} else {
								Ext.Msg.show({
											title : '错误',
											msg : json.msg,
											buttons : Ext.Msg.OK
										});
							}
						},
						failure:function(response){
							var json = Ext.decode(response.responseText);
							Ext.MessageBox.alert('错误','');
						}
					});
				}
				// scope.billwin.setEditable(true);//放置到显示后设置是否可变及，对于日期控件等。没有初始化就设置可编辑，会报部分变量undefined
			} else {Ext.MessageBox.alert('错误', '请选择一条记录！');}
		},this);
	},
	//查看流程状态
	doViewBPM:function(){
		var scope=me=this;
		var rows = me.getHeadGrid().getSelectionModel().getSelections();
		if (rows.length == 1) {
			Ext.Msg.wait('正在加载数据，请稍候......', '提示');
			Ext.Ajax.request({
				url : me.billIsInProcessUrl,
				params : {
					id : me.headCurrentPK
				},
				success : function(request) {
					var json = Ext.decode(request.responseText);
					if (json.success) {
						var win = new Ext.Window({
							title : '流程实例历史',
							width : 800,
							height : 400,
							autoScroll : true,
							modal : true,
							items : [new OECP.bpm.ProcessInstanceHisView({billKey:me.headCurrentPK})]
						});
						Ext.Msg.hide();
						win.show();
					} else {
						Ext.Msg.hide();
						Ext.Msg.show({
							title : '提示',
							msg : json.msg,
							buttons : Ext.Msg.OK
						});
					}
				},
				failure : function(request) {
					Ext.Msg.hide();
					Ext.Msg.show({title:"错误",msg:'您的网络可能不通畅，请稍后再试。',buttons:Ext.Msg.OK});
				}
			});
		}else{
			Ext.MessageBox.alert('错误', '请选择一条记录！');
		}
	},
	/**
	 * 单据流中的按照业务制单
	 */
	addByBussiness : function(scope,bizTypeId,functionCode){
		Ext.Msg.wait('正在加载数据，请稍候......', '提示');
		//发送请求加载gird列数据信息
		Ext.Ajax.request({
			url:__ctxPath + "/billflow/loadRSColumns.do",
			params:{
				bizTypeID:bizTypeId,
				functionCode:functionCode
			},
			success : function(h) {
				var me = {};
				//1、处理返回的grid 列数据
				var data =  eval("("+h.responseText+")");
		        var columns = data['colModel']['config'];
		        //2、 拼装查询条件
		        var queryFieldData = [];
    			var rowIndex = 0;
    			for (var i = 1; i < columns.length; i++) {
    				var tmp = [];
    				if (!columns[i].hidden) {
    					tmp.push(columns[i].dataIndex);
    					tmp.push(columns[i].header);
    					tmp.push(columns[i].fieldType?columns[i].fieldType:'java.lang.String');
    					// 查询条件默认值 默认查询条件控制
    					queryFieldData[rowIndex] = tmp;
    					rowIndex += 1;
    				}
    			}
    			//3、查询条件的窗口
				var queryWindow = new OECP.ui.QueryWindow({
							fieldData : queryFieldData,
							conditionKey :'queryConditions',
							refs : null,
							persOperator : {
								name : [['=', '等于']]
							}
				});
				//4、点击查询条件窗口的查询按钮触发
    			queryWindow.on('afterquery', function(query) {
    					if (typeof query.conditionResult != 'undefined') {
    						//4.1组装查询条件
    						var params = query.conditionResult;
    						params['bizTypeID'] = bizTypeId;
    		        		params['functionCode'] = functionCode;
    		        		params['limit'] = 10;
    		        		
    		        		
							//4.2隐藏查询窗口
							queryWindow[queryWindow.closeAction]();
							//4.3组装成store的field
		                    var storeFields = [];
		                    for(var i=0;i<columns.length;i++){
		                    	var columnss = columns[i];
		                    	storeFields.push(columns[i]['dataIndex']);
		                    }
		                   //4.4组装成store
		                    var store = new Ext.data.JsonStore({
								url :__ctxPath + "/billflow/query.do",
								baseParams : params,	
								remoteSort : true,	
								root : 'result',
								fields : storeFields,
								totalProperty : 'totalCounts'
							});	
		                    //4.5加载store,把Store加入grid
				            store.load();
				            
				            data['store'] = store;
				            //4.6组装grid的底部分页工具栏
				            //页面里面选择的datavo数组
				            var selectedData = new Array();
				            data['bbar'] = new Ext.PagingToolbar({
		            			pageSize : scope.headPageSize,
		            			store : store,
		            			displayInfo : true,
		            			displayMsg : '当前显示 {0}-{1}条记录 /共{2}条记录',
		            			emptyMsg : "无显示数据",
		            			listeners :{
		            				beforechange:function(){
			            				var resultGrid = billListWindow.items.first();
			            				var selectionModel = billListWindow.items.first().getSelectionModel();
			            				//把页面选中的值放入js变量里面
			            				scope.setSelectedValue(scope,selectionModel,selectedData,resultGrid);
			            			},
			            			change:function(){
			            				var resultGrid = billListWindow.items.first();
			            				var selectionModel = billListWindow.items.first().getSelectionModel();
			            				//将js变量里面的值放入页面选中的状态
			            				scope.setValueSelected(scope,selectedData,selectionModel,resultGrid);
			            			}
		            			} 
		            		});
							//4.7组装grid的顶部按钮工具栏
							data['tbar'] = [{
								xtype : 'button',
								style : 'margin:4px 10px 4px 10px',
								text : '确定',
								keyBinding:{key:'o',alt:true},showHotKey:true,
								scope : this,
								pressed : true,
								iconCls : 'confirm',
								handler :function(){
									//选择上游单据后，组装vo数据
									var resultGrid = billListWindow.items.first();
		            				var selectionModel = billListWindow.items.first().getSelectionModel();
		            				scope.setSelectedValue(scope,selectionModel,selectedData,resultGrid);
									if(selectedData.length==0){
										Ext.Msg.alert('提示','请至少选择一条记录');
										return;
									}
									billListWindow[billListWindow.closeAction]();
									var preDatas = "";
									for (var i = 0; i < selectedData.length; i++) {
										var datavo = selectedData[i];
										for(var j=0;j<storeFields.length;j++){
											if(storeFields[j]!=null&&storeFields[j]!=''){
												if(preDatas!='')
													preDatas+=",";
												var value = datavo[storeFields[j]];
												preDatas+="'simpleDataVOs["+i+"]."+storeFields[j];
												preDatas+="':'";
												preDatas+=value;
												preDatas+="'";
											}	
										}
									}
									//处理vo数据，传向后台，进行制单处理
									var jsonBean = Ext.decode("{"+preDatas+"}");
									jsonBean['bizTypeID'] = bizTypeId;
									jsonBean['functionCode'] = functionCode;
									
									//默认打开第一个单据的编辑页面
									Ext.Msg.wait('正在加载数据，请稍候......', '提示');
									//alert(scope.preDatasUrl);
									Ext.Ajax.request({
										url: scope.preDatasUrl,
										params:jsonBean,
										success : function(h) {
											var json = Ext.decode(h.responseText);
											if(json.success){
												Ext.Msg.hide();
												scope.getHeadGrid().store.removeAll();
												scope.getHeadGrid().store.loadData(json,false);
												scope.getHeadGrid().selModel.selectRow(0,true); 
												scope.headCurrentPK = '';
												scope.editBtn.fireEvent("click");
											}else{
												Ext.Msg.hide();
												Ext.Msg.show({
													title : '错误',
													msg : json.msg,
													buttons : Ext.Msg.OK
												});
											}
										},
										failure : function(h) {
											Ext.Msg.hide();
											Ext.Msg.alert('提示',h.responseText,function(){});
										}
									});
								}
							},{
								xtype : 'button',
								style : 'margin:4px 10px 4px 10px',
								text : '查询',
								keyBinding:{key:'q',alt:true},showHotKey:true,
								scope : this,
								pressed : true,
								iconCls : 'search',
								handler : function(){
									billListWindow[billListWindow.closeAction]();
									queryWindow.show();
								}
							},{
								xtype : 'button',
								style : 'margin:4px 10px 4px 10px',
								text : '关闭',
								keyBinding:{key:'c',alt:true},showHotKey:true,
								scope : this,
								pressed : true,
								iconCls : 'close',
								handler : function(){
									queryWindow[queryWindow.closeAction]();
									billListWindow[billListWindow.closeAction]();
								}
							}];
							//4.8、处理完grid数据,展现查询单据列表窗口
							var billListWindow = new OECP.ui.CommonWindow({
								title:'查询单据列表',
								width:520,
								height:420,
								closeAction : 'hide',
								componetArray : [data]
							});
							//4.9查询单据的结果列表
							billListWindow.show();
    					}
    				});
    				queryWindow.show();
    				Ext.Msg.hide();
			},
			failure : function(h) {
				Ext.Msg.hide();
				Ext.Msg.alert('提示',h.responseText,function(){});
			}
		});
	},
	//提交审批
	doCommit:function(){
		var scope = this;
		Ext.Msg.wait('正在提交，请稍候......', '提示');
		Ext.Ajax.request({
			url : scope.commitUrl||'',
			params : {id : me.headCurrentPK,functionCode : me.functionCode},
			success : function(request) {
				var json = Ext.decode(request.responseText);
				if (json.success) {
					Ext.Msg.hide();
					Ext.ux.Toast.msg('信息',	json.msg);
					me.getHeadGrid().store.reload();
				} else {
					Ext.Msg.hide();
					Ext.Msg.show({title : '错误',msg : json.msg,	buttons : Ext.Msg.OK});
				}
			},
			failure : function(request) {
				Ext.Msg.hide();
				Ext.Msg.show({title:"错误",msg:'您的网络可能不通畅，请稍后再试。',buttons:Ext.Msg.OK});
			}
		});
	},
		
	/**
	 * 分页选中数据存储
	 */
	setSelectedValue : function(scope,selectionModel,selectedData,resultGrid){
		if(selectionModel.hasSelection()){
			  var selections=selectionModel.getSelections();
			  Ext.each(selections,function(item){
				  var record = item.data;
				  scope.insertDataVoToMap(scope,selectedData,record);
			  });
		}
		scope.deleteSelectedDataVoToMap(scope,selectionModel,selectedData,resultGrid);
	},
	/**
	 * 选中数据存储在js变量中
	 */
	insertDataVoToMap : function(scope,selectedData,record){
		  var bool=false;
		  for(var i=0;i<selectedData.length;i++){
			  if(scope.equal(record,selectedData[i])){
				  bool=true;
				  break;   
			  }
		  }
		  if(!bool){
			  selectedData.push(record);   
		  }
	},
	/**
	 * 删除已经选择之后又取消的
	 */
	deleteSelectedDataVoToMap : function(scope,selectionModel,selectedData,resultGrid){
		for(var i=0;i<selectedData.length;i++){
			for(var j=0;j<resultGrid.getStore().getCount();j++){
				if(!selectionModel.isSelected(resultGrid.getStore().getAt(j))){
					var datavo = resultGrid.getStore().getAt(j).data;
					 if(scope.equal(datavo,selectedData[i])){
						  selectedData.remove(selectedData[i]);
						  break;
					  }
				}
			  }
		}
	},
	/**
	 * 分页选中数据赋值
	 */
	setValueSelected : function(scope,selectedData,selectionModel,resultGrid){
		 for(var i=0;i<selectedData.length;i++){
			  for(var j=0;j<resultGrid.getStore().getCount();j++){
				  if(scope.equal(resultGrid.getStore().getAt(j).data,selectedData[i])){
					  selectionModel.selectRow(j,true);
				  }
			  }
		}
	},
	
	/**
	 * 判断两个对象的属性值是否相等
	 */
	equal : function (objA, objB)
	{
		var result = true;
		var attributeLengthA = 0;
		var attributeLengthB = 0;
		for (var o in objA)
        {
			if(objA[o]==objB[o]){
				
			}else{
				result = false;
				break;
			}
            ++attributeLengthA;
        }
        for (var o in objB) {
            ++attributeLengthB;
        }
        //如果两个对象的属性数目不等，则两个对象也不等
        if (attributeLengthA != attributeLengthB)
            result = false;
        
        return result;
	},
	//审批
	doAudit:function(){
		me=this;
		Ext.Msg.wait('正在加载数据，请稍候......', '提示');
		Ext.Ajax.request({url:me.auditUrl||'',params:{id:me.headCurrentPK},
			success : function(request) {
				var json = Ext.decode(request.responseText);
				if (json.success) {
					var executeTaskwin = new Ext.Window({
					    id:'executeTaskwin',
						width:620,
						height:340,
						modal:true,
						autoScroll:true,
						closeAction:'hide',
						listeners:{'hide':function(){me.getHeadGrid().store.reload();}},
						items:[
							new OECP.bpm.PersonalTaskAuditView({
								counterSignRuleId:json.msg,
								funcKey:me.functionCode,
								bizKey:me.headCurrentPK,
								billInfo:me.billinfo
							})
						]
					});
					Ext.Msg.hide();
					executeTaskwin.show();
				} else {
					Ext.Msg.hide();
					Ext.Msg.show({title:'错误',msg:json.msg,buttons:Ext.Msg.OK});
				}
			},
			failure : function(request) {
				Ext.Msg.hide();
				Ext.Msg.show({title:"错误",msg:'您的网络可能不通畅，请稍后再试。',buttons:Ext.Msg.OK});
			}
		});
	},
	//查看上游单据
	doPrebill:function(){
		scope=this,rows = scope.getHeadGrid().getSelectionModel().getSelections();
		if (rows.length == 1) {
			scope.getHeadGrid().getSelectionModel()
			.each(function(_record) {
				Ext.Msg.wait('正在加载数据，请稍候......', '提示');
				//发送请求加载数据信息
				Ext.Ajax.request({
					url:__ctxPath + "/billflow/getBillFlowHistory.do",
					params:{
						billId : _record.data.id,
						functionCode : scope.functionCode,
						seeDirection : 'UP'
					},
					success : function(h) {
						var data =  Ext.decode(h.responseText);
						_record.json['billURL'] = me.currentBillUrl;
						if(data.success){
							var billFlowHistoryWindow = new OECP.ui.BillFlowHistory.Window({
								up : true,
								currentJsonData : _record.json,
								jsonData : data['result']
							});
							Ext.Msg.hide();
							billFlowHistoryWindow.show();
							//滚动条到最右边
							billFlowHistoryWindow.mainPanel.body.dom.scrollLeft = (billFlowHistoryWindow.mainPanel.body.getWidth()+100);
							billFlowHistoryWindow.afterWindowdrawLine();
						}else{
							Ext.Msg.hide();
							Ext.Msg.show({
								title : '错误',
								msg : data.msg,
								buttons : Ext.Msg.OK
							});
						}
						
					}
				});
				
			});
		}else {
			Ext.MessageBox.alert('错误', '请选择一条记录！');
		}
	},
	//查看下游单据
	doNextBill:function() {
		scope= this;
		var rows = scope.getHeadGrid().getSelectionModel().getSelections();
		if (rows.length == 1) {
			scope.getHeadGrid().getSelectionModel()
			.each(function(_record) {
				Ext.Msg.wait('正在加载数据，请稍候......', '提示');
				//发送请求加载数据信息
				Ext.Ajax.request({
					url:__ctxPath + "/billflow/getBillFlowHistory.do",
					params:{
						billId : _record.data.id,
						functionCode : scope.functionCode,
						seeDirection : 'DOWN'
					},
					success : function(h) {
						var data =  Ext.decode(h.responseText);
						_record.json['billURL'] = me.currentBillUrl;
						if(data.success){
							var billFlowHistoryWindow = new OECP.ui.BillFlowHistory.Window({
								up : false,
								currentJsonData : _record.json,
								jsonData : data['result']
							});
							Ext.Msg.hide();
							billFlowHistoryWindow.show();
							
							billFlowHistoryWindow.afterWindowdrawLine();
						}else{
							Ext.Msg.hide();
							Ext.Msg.show({
								title : '错误',
								msg : data.msg,
								buttons : Ext.Msg.OK
							});
						}
						
					}
				});
			});
		}else {
			Ext.MessageBox.alert('错误', '请选择一条记录！');
		}
	},
	
	//按钮权限
	buttonToAccess:function(){
		var buttons=[]; 
        Ext.ComponentMgr.all.each(function(cmp) { 
          if (cmp instanceof OECP.ui.Button) { 
              buttons.push(cmp); 
          } 
        }); 
		var btnPerArray = this.btnPermission;
		var flag = '0';
		for(var j=0;j<buttons.length;j++){
			for(var i=0;i<btnPerArray.length;i++){
				if(buttons[j].pid == btnPerArray[i]){
					buttons[j].hidden = true;
					flag = '1';
				}
			}
			if(flag=='0')
				buttons[j].hidden = false;
		}
	},
	//private 重置内部变量 清空变量防止加载报错
	clearBillProperty:function(){
		if(this.headGrid) {
			this.headGrid = undefined;
		};
		if(this.headStore) {
			this.headStore= undefined;
		}
		if(this.bodyGrid){
			if(Ext.isObject(this.bodyGrid)){
				this.bodyGrid= undefined;
			}else if(Ext.isArray(this.bodyGrid)){
				for(var i=0;i<this.bodyGrid;i++){
					delete this.bodyGrid[i];
				}
				this.bodyGrid = undefined;
			}
		}
		if(this.bodyStore){
			if(Ext.isObject(this.bodyStore)){
				Ext.destroy(this.bodyStore);
			}else if(Ext.isArray(this.bodyStore)){
				for(var i=0;i<this.bodyStore;i++){
					Ext.destroy(this.bodyStore[i]);
				}
			}
			this.bodyStore =undefined;
		}
		if(this.queryWindow){
			Ext.destroy(this.queryWindow);
		}
		this.queryWindow = undefined;
	},
	// private 初始化变量
	initBillProperty : function() {
		this.getHeadGrid();
		this.getHeadStroe();
		this.getBodyGrids();
		this.getBodyStore();
		this.bindStore();
		this.initHeadGridEvent();
	},
	//private 重新绑定数据 主表store不能指定，只能重新绑定
	bindStore:function(){
		var me=this,hg = this.getHeadGrid();
		if(hg){
			hg.reconfigure(this.getHeadStroe(),hg.getColumnModel());
			btbar = hg.getBottomToolbar();
			if(btbar){
				btbar.bind(this.getHeadStroe());//绑定分页
			}
		}
		bg = this.getBodyGrids();
		if(bg && Ext.isObject(bg)){
			bg.reconfigure(this.getBodyStoreByName(bg.eoname),bg.getColumnModel());
		}else if(bg && Ext.isArray(bg)){
			Ext.each(bg,function(o){
				//alert(o.eoname);
				o.reconfigure(this.getBodyStoreByName(o.eoname),o.getColumnModel());
			},this);
		}
	},
	/**
	 * 获取主表表格
	 * 
	 * @return {Ext.gird.GridPanel}
	 */
	getHeadGrid : function() {
		var me = this;
		if (!this.headGrid && this.headEntityName) {
			//约定取第一个Grid 为主表grid
			var forEachFindHeadGrid = function(_item){
				if(!_item || me.headGrid) return ;
				if(Ext.isArray(_item)){
					Ext.each(_item,function(o){
						forEachFindHeadGrid(o);
					});
				}else if(Ext.isObject(_item)){
					var _xtype = _item.xtype ||(Ext.isFunction(_item.getXType)?_item.getXType():'') || '';
					if(['grid','oecpgrid'].indexOf(_xtype)!=-1){
						me.headGrid= _item;
						me.headGrid.eoname=me.headEntityName;
					}else if(_item.items){
						forEachFindHeadGrid(_item.items);
					}
				}
			};
			forEachFindHeadGrid(this.items);
		}
		return this.headGrid;
	},
	
	/**
	 * 多主多子表的表单赋值 点击行记录后 更新相应的数据
	 * @returns
	 */
	setMiFormValues : function (me,data){
		var forms = me.findByType("form");
		for(var i=0;i<forms.length;i++){
			var form = forms[i];
			// 只要不是查询表单就赋值
			if(form != me.quickQueryPanel){
				form.getForm().setValues(data);
			}
		}
	},
	/**
	 * 获取主表数据仓库
	 * 
	 * @return {Ext.data.JsonStore}
	 */
	getHeadStroe : function() {
		if (!this.headStore && this.headEntityName) {
			var me = this;
			cloneCfg= OECP.core.util.clone(this[this.headEntityName + '_liststore_cfg']);//克隆对象，防止地址引用对原始config做初始化
			this.headStore = new Ext.data.JsonStore(cloneCfg);
			var bp = {limit:this.headPageSize,start:0};//追加参数,用于默认查询
			this.headStore.baseParams = this.headStore.baseParams?Ext.applyIf(bp,this.headStore.baseParams):bp;
			this.headStore.on({
				'load': {
		            fn: function(store, records, options){
		              me.selectHeadAt(0);
		            },
		            scope: me
				},
				'loadexception': {
					fn: function(obj, options, response, e){
						Ext.MessageBox.alert("表头数据加载异常",e);
			        },
			        scope: me
			      }
			});
		}
		return this.headStore;
	},
	getBodyGridByEoname:function(eoname){
		bg = this.getBodyGrids();
		if(bg && Ext.isObject(bg)){
			if(bg.eoname === eoname){
				return bg;
			}
		}else if(bg && Ext.isArray(bg)){
			for(var i=0;i<bg.length;i++){
				if(bg[i].eoname === eoname){
					return bg[i];
				}
			}
		}
		return null;
	},
	/**
	 * 获取子表表格/集合
	 * 
	 * @return {Ext.grid.GridPanel/Array}
	 */
	getBodyGrids : function() {
		var me = this;
		if (!this.bodyGrid && this.bodyEntityName) {
			forEachFindGrid = function(item,ename,isarray){
				if(Ext.isObject(item)){
					if(item.eoname && item.eoname === ename){
						if(isarray){
							me.bodyGrid.push(item);
						}else{
							me.bodyGrid =item;
							return;
						}
					}
					if(item.items){
						forEachFindGrid(item.items,ename,isarray);
					}
				}else if(Ext.isArray(item)){
					for(var i=0;i<item.length;i++){
						forEachFindGrid(item[i],ename,isarray);
					}
				}
			};
			if (Ext.isString(this.bodyEntityName)) {
				forEachFindGrid(this.items,this.bodyEntityName,false);
			} else if (Ext.isArray(this.bodyEntityName)) {
				this.bodyGrid = [];
				for(var i=0;i<this.bodyEntityName.length;i++){
					forEachFindGrid(this.items,this.bodyEntityName[i],true);
				}
			}
		}
		return this.bodyGrid;
	},
	/**
	 * 获取子表数据仓库/集合
	 * 
	 * @return {Ext.data.JsonStore/Array}
	 */
	getBodyStore : function() {
		if (!this.bodyStore && this.bodyEntityName) {
			if (Ext.isString(this.bodyEntityName)){
				cloneObj=OECP.core.util.clone(this[this.bodyEntityName + '_liststore_cfg']);
				this.bodyStore = new Ext.data.JsonStore(cloneObj);
				this.bodyStore.eoname=this.bodyEntityName;
			} else if (Ext.isArray(this.bodyEntityName)) {
				this.bodyStore = [];
				for (var i = 0; i < this.bodyEntityName.length; i++) {
					var cloneObj=OECP.core.util.clone(this[this.bodyEntityName[i] + '_liststore_cfg']);
					var _s = new Ext.data.JsonStore(cloneObj);
					_s.eoname=this.bodyEntityName[i];
					this.bodyStore.push(_s);
				}
			}
		}
		return this.bodyStore;
	},
	/**
	 * 根据实体名获取store
	 * @param {String} _eoname 实体名
	 * @return {Ext.data.Store}
	 */
	getBodyStoreByName:function(_eoname){
		var bs = this.getBodyStore();
		if(bs && Ext.isObject(bs)){
			return bs.eoname===_eoname?bs:null;
		}else if(bs && Ext.isArray(bs)){
			for(var i=0;i<bs.length;i++){
				if(bs[i].eoname===_eoname){
					return bs[i];
				}
			}
		}
		return {};
	},
	// private 初始化行点击事件
	initHeadGridEvent : function() {
		var me = this;
		if (!this.getHeadGrid())
			return;
		this.getHeadGrid().getSelectionModel().on('selectionchange',function(e){
			var rows = e.getSelections();
			var pk;
			if(rows.length>0){
				pk = rows[0].data[me.headPrimaryKey];
				me.billinfo = rows[0].data['billsn'];
				// 给tab表赋值 
				me.setMiFormValues(me,rows[0].data);
			}
			if (me.headCurrentPK !== pk) {
				me.headCurrentPK = pk;
				if (!me.headCurrentPK) {
					me.removeAllBodyStroe();
				} else {
					//加载表体数据
					me.removeAllBodyStroe();
					me.reloadBodyStore();
				}
			}
			//流程按钮控制
			me.changeButtonState();
		});
		//双击查看单据
		this.getHeadGrid().on('rowdblclick',function(grid,index,e){
			// scope.billId = grid.getStore().getAt(index).get(this.headPrimaryKey);
			if(!this.viewWin) this.viewWin.call(me);
			
			this.viewWin.doQuery({
			    params:{id:me.headCurrentPK},
			    success:function(request){
				var json = Ext.decode(request.responseText);
				if (json.success) {
				    if(me.viewWin.bill.initComplete){//判断界面是否加载完成
					// me.billwin.setEditable(true);
				    }else{
					me.viewWin.bill.viewEditable=false;
				    }
				    me.viewWin.setEditable(false);
				    me.viewWin.show();
				    me.viewWin.reset();
				    me.viewWin.bill.setValues(json.result);// 赋值
				} else {
					Ext.Msg.show({
								title : '错误',
								msg : json.msg,
								buttons : Ext.Msg.OK
							});
				}
			},
			failure:function(response){
				var json = Ext.decode(response.responseText);
				Ext.MessageBox.alert('错误',json.msg);
			}});
			// this.viewWin.bizSaveButton.setVisible(false);
		},this);
		
	},
	initQueryPanel : function(){
		var me = this;
		if(me.quickQueryPanel){
			me.mainPanel.remove(me.quickQueryPanel,true);
		}
		if(me.queryScheme){
			me.initQueryPanelWithScheme();
		}else{
			me.initDefaultQueryPanel();
		}
		me.doLayout();
	},
	initDefaultQueryPanel:function(){
		if(me.quickQueryCfg){
			me.initQuickQuery();
			me.mainPanel.add(me.quickQueryPanel);
		}
	},
	initQueryPanelWithScheme:function(){
		var me = this;
		if(me.queryScheme.commoncondConditions){
			me.quickQueryPanel=new Ext.FormPanel({//查询面板
				plugins:new Ext.ux.ToolbarKeyMap(),
				collapsible : true,
				region:'north',layout:'border',frame:true,items:[
						{xtype:'panel',region:'center',autoHeight:true},
						{xtype:'panel',region:'east',width:100,items:[me.querybtn_cfg]
						}
				]
			});
			
			var _items=[],conditions=me.queryScheme.commoncondConditions,operators=me.queryScheme['operator'],num=0;
			_items[0]=[];
			for(var i=0;i<conditions.length;i++){
				var cfg=conditions[i],operator=operators[cfg.operators[0]].operator,_defaultVal=conditions[i].defaultvalue||'';
				if(i>0 && i%4==0) {//每4个控件换一行
					num++,_items[num]=[];
				}
				var _tmpCfg={xtype:'textfield',width:120,fieldLabel:cfg.dispname,name:'conditions['+i+'].value',hiddenName:'conditions['+i+'].value',editable:true,forceSelection: true,value:_defaultVal};//"查询值"录入框
				if(cfg.required) _tmpCfg['allowBlank']=false;
				if(cfg.editorcfg && !Ext.isEmpty(cfg.editorcfg,false)){//判断其他参数非空后，转换为对象并合并参数。
					_tmpCfg=Ext.apply(_tmpCfg,Ext.decode(cfg.editorcfg));
				}
				if(_tmpCfg.xtype=='checkbox' && Ext.isEmpty(_tmpCfg.inputValue)){ // checkbox添加inputValue属性，否则选中时提交on
				    _tmpCfg.inputValue = true;
				}
				_items[num].push(new Ext.Panel({
					width:250,frame:true,layout:'form',baseCls:'',	items:[_tmpCfg,
						{xtype:'textfield',name:'conditions['+i+'].field',value:cfg.field,hidden:true},
						{xtype:'textfield',name:'conditions['+i+'].fieldType',value:cfg.fieldType||"java.lang.String",hidden:true},
						{xtype:'textfield',name:'conditions['+i+'].operator',value:operator,hidden:true}
					]
				}));
			}
			for(var i=0;i<_items.length;i++){
				_items[i]=new Ext.Panel({layout:'column',items:_items[i]});
			}
			if(Ext.isEmpty(_items)){
				me.quickQueryPanel.setVisible(false);//无查询条件就隐藏
			}else{
				me.quickQueryPanel.items.get(0).add(_items);//追加查询条件
				me.quickQueryPanel.items.get(0).on('afterlayout',function(){
				    var h = me.quickQueryPanel.items.get(0).getHeight();
				    if(h!==0){
					if(me.quickQueryPanel.body.getHeight()!==h){
					    me.quickQueryPanel.body.setHeight(h);
					    if(!me.mainPanel.relayout){
						me.mainPanel.doLayout();
						me.mainPanel.relayout = true;
					    }
					}
				    }
				});
				me.mainPanel.on('resize',function(){
				    me.mainPanel.doLayout();
				});
			}
			me.mainPanel.add(me.quickQueryPanel);
		}
	},
	
	// private 初始化查询框 (只有主表查询条件)
	initQueryWin : function() {
		var me = this;
		if(me.queryScheme){
			me.initQueryWinWithScheme();
		}else{
			me.initDefaultQueryWin();
		}
		
		this.queryBtn.on('click', function(btn, event) {
			me.queryWindow.show();
		}, me);
	},
	// 根据查询方案初始化查询窗体
	initQueryWinWithScheme:function(){
		var me = this;
		var _fieldData=[],_persOperator={},_conditions=me.queryScheme.conditions,_fieldDefaultValue={},refs={};
		var fieldsAllowBlank={},refs={};
		for(var i=0;i<_conditions.length;i++){//初始查询框参数
			var _fieldname=_conditions[i].field,_dispname=_conditions[i].dispname;
			var _fieldType=Ext.isEmpty(_conditions[i].fieldType)?'java.lang.String':_conditions[i].fieldType;
			var _operators=_conditions[i].operators,refCfg={};
			_fieldData.push([_fieldname,_dispname,_fieldType]);//字段名
			if(!Ext.isEmpty(_operators)){//有专有条件符
				_persOperator[_fieldname]=[];
				for(var j=0;j<_operators.length;j++)//通过枚举值获取条件符
					_persOperator[_fieldname].push(me.queryScheme.operator[_operators[j]].operator);
			}
			if(_conditions[i].defaultvalue) _fieldDefaultValue[_fieldname]=_conditions[i].defaultvalue;//拼装默认值
			if(_conditions[i].editorcfg) {
				var _eidtcfg = Ext.decode(_conditions[i].editorcfg);
				_eidtcfg.allowBlank = !_conditions[i].required;
				refCfg=Ext.create(_eidtcfg);
			}else{
				refCfg={xtype:'textfield',allowBlank:!_conditions[i].required};
			}
			refs[_fieldname]=new Ext.grid.GridEditor({field:refCfg});
			fieldsAllowBlank[_fieldname]=!_conditions[i].required;
		}
		me.queryWindow=new OECP.ui.QueryWindow({conditionKey:'conditions',fieldData :_fieldData,persOperator: _persOperator,fieldDefaultValue:_fieldDefaultValue,refs:refs,fieldsAllowBlank:fieldsAllowBlank});
		me.queryWindow.on('beforequery',function(query){
				for (var i=0; i<query.queryStore.getCount(); i++) {
					var _r=query.queryStore.getAt(i),_cs=query.columnsStore;
					var _field=_r.get(_cs[0][0]),_value=_r.get(_cs[2][0]);
					if(!query.fieldsAllowBlank[_field] && Ext.isEmpty(_value,false)){
						query.queryGrid.startEditing(i,3);
						return false;
					}
				}
		});
		me.queryWindow.on('afterquery', function(query) {
			if (Ext.isDefined(query.conditionResult)) {
				//赋值查询条件,执行查询
				me.doQuery.call(me,query.conditionResult);
			}
		}, me);
	},
	// 初始化默认查询窗体
	initDefaultQueryWin:function(){
		cm = me.getHeadGrid()?me.getHeadGrid().getColumnModel():undefined;
		var cfg = [], idx = 0, t = 'java.lang.String',refs={};
		for (var i = 1; i < cm.getColumnCount(); i++) {// 拼装查询条件
			var hc = cm.getColumnAt(i);
			var err = false;
			try{hc.editor.field.xtype;}catch(e){err = true;}//尝试获取xtype
			if(!err){
				if(hc.editor.field.xtype=='datefield')
					t='java.util.Date';
			}
			if (!hc.hidden) {
				cfg[idx] = [hc.dataIndex, hc.header, hc.fieldType || t];
//					if(t=='java.util.Date'){
					refs[hc.dataIndex]=new Ext.grid.GridEditor(hc.editor.field);
//					}
				++idx;
			}
		}
		me.queryWindow = new OECP.ui.QueryWindow({
			conditionKey : 'conditions',
			fieldData : cfg,
			defaultCondition : Ext.applyIf({functionCode:me.functionCode},me.headStoreParams||{}),
			refs : refs,
			persOperator : {name : [['=', '等于']]}
		});
		me.queryWindow.on('afterquery', function(query) {
			if (Ext.isDefined(query.conditionResult)) {
				//赋值查询条件,执行查询
				me.doQuery.call(me,query.conditionResult);
			}
		}, me);
	},
	
	/**
	 * 赋值查询条件，并执行查询
	 * @param {} ops 查询条件
	 */
	doQuery:function(ops){
		this.queryBaseParams = ops || {},me=this;
		if(!this.queryBaseParams.limit){
		    this.queryBaseParams.limit = me.headPageSize;
		}
		this.getHeadGrid().store.baseParams = this.queryBaseParams;
		this.getHeadGrid().store.baseParams['functionCode'] = me.functionCode;
		this.getHeadGrid().store.load();
	},
	//流程按钮状态
	changeButtonState : function(){
		var scope = this;
		var rows = scope.getHeadGrid().getSelectionModel().getSelections();
		var len = rows.length;
		function updateBtnState(btn){
			if ((btn instanceof Ext.Button) && btn.menu) {
				btn.menu.cascade(updateBtnState);
			}
			var ub;			
			if(! (ub = btn.useable)){ // 没设置的不更新状态
				return ;
			}
			// 按钮设置单行可用，但是选择的不是1行的时候。
			if(len != 1 && ub.single){
				btn.disable();
				return ;
			}
			// single为false的表示多行可用，如果没有选中行，则直接不可用。
			if(len < 1 && ub.single === false){
				btn.disable();
				return ;
			}
			// 多行的只要有一行的状态在按钮上设置为false，则按钮不可用。
			for( i = 0 ; i < len ; i++ ){
				if(ub[rows[i].data['state']] === false){
					btn.disable();
					return;
				}else{
				    if(ub.isUseabled){// 带有自定义函数的
					var isub = ub.isUseabled(rows,btn);
					if(isub === true){
					    btn.enable();
					}else{
					    btn.disable();
					}
				    }else{
					btn.enable();
				    }
				}
			}
		}
		this.topToolbar.cascade(updateBtnState);
	},
	// 选择表头第idx行
	selectHeadAt : function(idx) {
		if (this.getHeadStroe().getCount() > 0) {
			this.getHeadGrid().getSelectionModel().selectRow(idx);
			var pk = this.getHeadStroe().getAt(idx).get(this.headPrimaryKey);
			var pkIsNull = Ext.isEmpty(pk) || pk == 'null';
			if (pk != null && this.headCurrentPK !== pk) {
				this.headCurrentPK = pk;
				this.removeAllBodyStroe();
				this.reloadBodyStore();
			}
		} else {
			this.removeAllBodyStroe();
			this.changeButtonState();
		}
	},
	/** 重新加载表体 */
	reloadBodyStore : function() {
		var me = this,bs = this.getBodyStore();
		if (bs && (Ext.isObject(bs) ||  Ext.isArray(bs))) {
			Ext.Ajax.request({
				// 表体分页咋办
				params:Ext.apply(this.queryBaseParams||{},{id:me.headCurrentPK}),
				url:this.queryBillUrl||'',
				method:'post',
				success:function(response, opts){
					var obj = Ext.decode(response.responseText);
      				if(obj.success){
      					var bill = obj.result;
      					if(me.bodyEntityName && Ext.isString(me.bodyEntityName)){
      						var body = bill[me.bodyEntityName] || {};
      						var grid = me.getBodyGridByEoname(me.bodyEntityName);
      						grid.getStore().loadData(body);
      					}else if(me.bodyEntityName && Ext.isArray(me.bodyEntityName)){
      						for(var i=0;i<me.bodyEntityName.length;i++){
      							var body = bill[me.bodyEntityName[i]] || {};
	      						var grid = me.getBodyGridByEoname(me.bodyEntityName[i]);
	      						grid.getStore().loadData(body);
	      					}
      					}
      				}else{
      					Ext.MessageBox.alert('提示',obj.msg);
      				}
				},
				failure:function(){
					Ext.MessageBox.alert('错误','');
				},
				scope:this
			});
		}else if(bs && Ext.isArray(bs)){}
	},
	removeAllBodyStroe : function() {
		var bs = this.getBodyStore();
		if (!bs) return;
		if (Ext.isObject(bs)) {
			bs.removeAll();
		} else if (Ext.isArray(bs)) {
			Ext.each(bs, function(s) {s.removeAll();}, this);
		}
	},
	initSuccessCallback : function() {
	},
	initFaultCallback : function() {
	},
	onDestroy : function() {
		if(this.queryWindow) Ext.destroy(queryWindow);
		if(this.billwin) Ext.destroy(this.billwin);
		OECP.ui.BasicListBill.superclass.onDestroy.call(this);
	}
});







/********************************************************************************
				 					主从表编辑界面
********************************************************************************/

/**
 * 单据主从表 列表界面 (面板)
 * 
 * @class Ext.ui.BasicCardBill
 * @extends Ext.FormPanel
 */
OECP.ui.BasicCardBill = Ext.extend(Ext.FormPanel, {
	/** @cfg {Object} 			formView 			视图模板 */
	/** @cfg {String} 			headEntityName 		主表实体名 */
	/** @cfg {Array/String} 	bodyEntityName 		子表实体名 */
	/** @cfg {Boolean} 			editable 			能否编辑; true:可编辑,false:不可编辑 */
	editable : true,
	/** @cfg {String} 			submitUrl 			单据保存url地址 */
	/** @cfg {String} 			queryBillUrl		单据查询url地址 */
	/** @cfg {EditorGridPanel} 	bodyGrid 			表体网格 */
	/**
	 * @cfg {Object} 			bodyRefs 			表体参照，字段名对应相应的控件<p>例子:<br>
	 *      <code>{org:new OECP.ui.OrgRefField({...}),quantity:new Ext.form.NumberField({...}),status: new Ext.form.ComboBox({...})}</code>
	 */
	/** @cfg {Ext.data.Store} 	bodyStore 			表体数据 */
	/** @cfg {Array} 			bodyBtns 			表体自定义按钮 */
	/** @cfg {String} 			modifiedVarName 	对应后台Action变量名称。数据封装使用。如果没有默认使用form属性中的前缀. */
	/** @cfg {Array/Object} 	tailItem 			表尾控件 */
	/** @cfg {object} 			bodyDelRecords 		记录删除的子表数据 */
	bodyDelRecords : {},
	/** @cfg {Array} 			submitFilterField 	过滤字段，数组内的字段名不提交 */
	submitFilterField : [],
	/** @cfg {Boolean} 			initComplete		初始化标记，用于外部判断此试图是否加载乘公共*/
	initComplete : false,
	/** @cfg {Boolean}			viewEditable		界面是否可编辑 */
	viewEditable : true,
	/** 保存子表 按钮 */
	gridTbarBtns : {},
	minimizable:true,
	maximizable:true,
	layout:'fit',
	baseCls:'',//去除边线
	relations :null, // 主单据的关系变量
	detailRelations : null, // 明细单据的关系变量
	//用于传递参数
	transmit:function(){},
	initComponent : function() {
		var scope = this,me=this;
		this.addEvents(
				/**
				 * @event submitsuccess 提交成功事件
				 * @param {Object}
				 *            response 包含数据的xhr对象
				 * @param {Object}
				 *            opts 请求所调用的参数
				 * @param {MasterDetailEditPanel}
				 *            scope 作用域
				 */
				'submitsuccess',
				/**
				 * @event submitfailure 提交失败事件 *
				 * @param {Object}
				 *            response 包含数据的xhr对象
				 * @param {Object}
				 *            opts 请求所调用的参数
				 * @param {MasterDetailEditPanel}
				 *            scope 作用域
				 */
				'submitfailure',
				/**
				 * @event beforerowadd 增行前事件
				 * @param {Object}
				 *            event <br>
				 *            事件源包含以下属性 <br>
				 *            scope - 作用域编辑面本本身<br>
				 *            grid - 表体网格<br>
				 *            record - 要增加的数据集<br>
				 *            btn - 按钮<br>
				 *            btnEvent - 按钮事件源
				 */
				'beforerowadd',
				/**
				 * @event afterrowadd 增行后事件
				 * @param {Object}
				 *            event <br>
				 *            事件源同beforerowadd
				 */
				'afterrowadd',
				/**
				 * @event beforerowdel 删行前事件
				 * @param {Object}
				 *            event <br>
				 *            事件源包含以下属性 <br>
				 *            scope - 作用域编辑面本本身<br>
				 *            grid - 表体网格<br>
				 *            record - 要增加的数据集数组<br>
				 *            btn - 按钮<br>
				 *            btnEvent - 按钮事件源
				 */
				'beforerowdel',
				/**
				 * @event afterrowdel 删行后事件
				 * @param {Object}
				 *            event <br>
				 *            事件源同beforerowdel
				 */
				'afterrowdel',
				/**
				 * @event loaddata 加载数据
				 * @param {this}
				 *            scope
				 */
				'loaddata');
		this.transmit();
		OECP.ui.BasicCardBill.superclass.initComponent.call(this);
		this.initView();// 加载视图
	},
	initView : function(newView) {
		var me=scope= this;
		// json=Ext.decode(newView||OECP.core.util.clone(this.formView));
		//XXX 此处有坑,使用Ext.decode是作用域有问题,始终是最上层的listpanel,这里执行json后获取到的cardgrid的store都定义到listpanel里了.
		// 使用临时解决 但是使用eval后 内部定义的store不在cardpanel内.也不知道作用域在哪里.
		json = eval("(" + (newView||this.formView) + ')');//
		var _view=json.result;
		this.removeAll();
		this.clearBillProperty();
		if(_view)this.add(_view);// 追加控件内容
		this.doLayout();
		this.initComplete = true;
		this.initButton();
		this.initBillProperty();// 初始化grid和store属性
		this.initSuccessCallback();
//		this.setEditable(this.viewEditable);//屏蔽。window中包含日期控件时，在当构造win后没显示去调用setReadOnly方法时报错，部分变量为undefined
	},
	clearBillProperty:function(){
		this.bodyStore=undefined;
		this.bodyGrid=undefined;
	},
	// private 初始化表格按钮
	initButton : function() {
		var bg = this.getBodyGrid();
		if (Ext.isObject(bg)) {
			// 单子表追加增行删行按钮
			rowAddBtn = new OECP.ui.button.RowAddButton(), rowDelBtn = new OECP.ui.button.RowDelButton();
			rowAddBtn.on('click', this.addRowAction.createDelegate(this,[bg],true), this);
			rowDelBtn.on('click', this.delRowAction.createDelegate(this,[bg],true), this);
			if (bg.eoname)
				this.gridTbarBtns[bg.eoname] = [rowAddBtn, rowDelBtn];
			if(bg.getTopToolbar()){
				bg.getTopToolbar().add(rowAddBtn, rowDelBtn);
				//bg.getTopToolbar().doLayout();
			}else
				bg.createFbar([rowAddBtn, rowDelBtn]);
		} else if (Ext.isArray(bg)) {
			// 多子表追加增行删行按钮
			for (var i = 0; i < bg.length; i++) {
				tbar = bg[i].getTopToolbar();
				rowAddBtn = new OECP.ui.button.RowAddButton(), rowDelBtn = new OECP.ui.button.RowDelButton();
				rowAddBtn.on('click', this.addRowAction.createDelegate(this,[bg[i]], true), this);
				rowDelBtn.on('click', this.delRowAction.createDelegate(this,[bg[i]], true), this);
				if (bg[i].eoname)
					this.gridTbarBtns[bg[i].eoname] = [rowAddBtn, rowDelBtn];
				tbar.add(rowAddBtn, rowDelBtn);
				tbar.doLayout();
			}
		}
	},
	initBillProperty : function() {
		this.getBodyGrid();
		this.getBodyStore();
	},
	initSuccessCallback : function(){},// 加载视图成功 回调函数
	initFaultCallback : function(){},// 加载视图失败 回调函数
	findItem : function(name) {
		return this.getForm().findField(name);
	},
	
	// 清除所有checkBox的值
	resetAllCheckbox : function(){
		var checks = this.findByType("checkbox");
		for(var i=0;i<checks.length;i++){
			var check = checks[i];
			if(check.reset) check.reset();
		}
	},
	// 获取表体表格/集合
	getBodyGrid : function() {
		var me = this;
		if (!this.bodyGrid && this.bodyEntityName) {
			if (Ext.isString(this.bodyEntityName)) {
				var foreachItems= function(item){
					if(Ext.isObject(item)){
						if (item.eoname && item.eoname === me.bodyEntityName) {
							me.bodyGrid=item;
							me.bodyGrid.clicksToEdit=1;
							return;
						}
						if(item.items){
							foreachItems(item.items);
						}
					}else if(Ext.isArray(item)){
						Ext.each(item,function(i){
							foreachItems(i);
						});
					}
				};
				foreachItems(this.items);
			} else if (Ext.isArray(this.bodyEntityName)) {
				var foreachItems = function(i) {
					if (i.eoname && this.bodyEntityName.indexOf(i.eoname) != -1){
					    	if(!this.bodyGrid)this.bodyGrid = [];
						this.bodyGrid.push(i);
						i.clicksToEdit=1;
					}
					if(i.items){
						i.items.each(foreachItems, this);
					}
				};
				
				this.items.each(foreachItems, this);
			}
		}
		return this.bodyGrid;
	},
	// 获取子表数据仓库/集合
	getBodyStore : function() {
		if (!this.bodyStore && this.bodyEntityName) {
			if (Ext.isString(this.bodyEntityName)) {
				cloneObj=OECP.core.util.clone(this[this.bodyEntityName + '_cardstore_cfg']);
				this.bodyStore = new Ext.data.JsonStore(cloneObj);
				this.bodyStore.eoname=this.bodyEntityName;
			} else if (Ext.isArray(this.bodyEntityName)) {
				this.bodyStore = [];
				for (var i = 0; i < this.bodyEntityName.length; i++) {
					cloneObj=OECP.core.util.clone(this[this.bodyEntityName[i] + '_cardstore_cfg']);
					var _s = new Ext.data.JsonStore(cloneObj);
					_s.eoname=this.bodyEntityName[i];
					this.bodyStore.push(_s);
				}
			}
		}
		return this.bodyStore;
	},
	getBodyStoreByName:function(eoname){
		if(this.bodyGrid){ // grid 已经初始化
			var grids = this.getBodyGrid();
			if(Ext.isArray(grids)){
				for(var i=0 ; i< grids.length; i++){
					if(grids[i].eoname == eoname){
						return grids[i].getStore();
					}
				}
			}else{
				return grids.getStore();
			}
		}else{ /// grid 未初始化
			var bs = this.getBodyStore();
			if(bs && Ext.isObject(bs)){
				return bs.eoname===eoname?bs:null;
			}else if(bs && Ext.isArray(bs)){
				for(var i=0;i<bs.length;i++){
					if(bs[i].eoname===eoname){
						return bs[i];
					}
				}
			}
		}
		return {};
	},
	findField : function(obj) {
		var rs = {xtype : null,field : null};
		if (!Ext.isDefined(obj)) {return rs;}
		if(obj.getEditor()){
			rs.xtype = obj.getEditor().field.getXType();
			rs.field = obj.getEditor().field;
		}else if(obj.xtype){
		    rs.xtype = obj.xtype;
		    if(obj.field){
			rs.field = obj.field;
		    }else{
			rs.field = obj;
		    }
		}
		return rs;
	},
	// private form组件的renderer方法,获取显示值使用
	findDisplayValue : function(value, metaData, record, rowIndex, colIndex,store, rs) {
		if (!rs || !rs.xtype) {return value;}
		var field = rs.field, fieldXType = rs.xtype, val = value;
		if (Ext.isDefined(field.findRecord) && Ext.isFunction(field.findRecord)) {// 判断是有下拉控件的方法
			var record = field.findRecord(field.valueField, value);
			if (record)
				val = record.data[field.displayField];
		} else if (Ext.isFunction(field.formatDate)) {// 判断有日期控件的方法
			val = field.formatDate(value);
		}
		return val;
	},
	/**
	 * private 由于后台EO没有数据状态属性，无法获取哪些是新增/修改那些是删除的数据，所以提交br>
	 * 用于保存的数据，用于删除的数据两部分，后台分别进行处理
	 */
	formatSubmitData : function() {
		var me = this;
		var flag = true;
		var _params = {}, _headData = this.getForm().getValues(), varName = this.headEntityName;
		// 表头数据封装
		for (_id in _headData) {
			if (!Ext.isEmpty(_headData[_id], false)) {// 过滤空值字段
				flag = true;
				if (me.submitFilterField.length > 0 && me.submitFilterField.indexOf(_id) != -1)// 判断包含过滤字段
					flag = false;
				if (flag)
					_params[varName + '.' + _id] = _headData[_id];
			}
		}
		// 封装中间表数据
		if(!Ext.isEmpty(me.relations,false)){
			_params[varName + ".relations"] = me.relations;
		}
		// 三个变量：属性 表体数据/集合; 数据下标; 提交过滤字段
		var bs = me.getBodyGrid(), index = 0, sff = me.submitFilterField;
		function pushGridParams(_bs,_bodyEntityName){
		    	index = 0;
			_store=_bs.getStore();
			_store.each(function(record) {
				var values = record.data;
				for (_id2 in values) {
					flag = true;
					if (sff.length > 0 && sff.indexOf(_bodyEntityName + "." + _id2) != -1) {
						flag = false;
					}
					if (flag) {
						_params[varName + '.' + _bodyEntityName + '[' + index + '].' + _id2] = values[_id2] instanceof Date?values[_id2].format('Y-m-d H:s:i'):values[_id2];
					}
				}
				++index;
			});
		}
		if (bs && Ext.isObject(bs)) {// 单子表
		    pushGridParams(bs,me.bodyEntityName);
		} else if (bs && Ext.isArray(bs)) {// 多子表
                    for (var i = 0; i < bs.length; i++) {
                        pushGridParams(bs[i],me.bodyEntityName[i]);
                    }
		}
		// 拼装删除数据
		if (Ext.isEmpty(me.bodyDelRecords)) {
			for (var _eoname in me.bodyDelRecords) {
				var _array = me.bodyDelRecords[_eoname];
				for (var i = 0; i < _array.length; i++) {
					var _data = array[i].data;
					for (var id in _data) {
						_params[_eoname + 's[' + i + '].' + id] = _data[id];
					}
				}
			}
		}
		return _params;
	},
	/**
	 * 2014-01-01 添加了表单的必填项验证 -- lyb
	 * 表单提交 <br>
	 * 对数据封装,使用ajax提交.<br>
	 * 不使用Form提交是考虑到store中的内容可以不用展现在页面上(如主键、单据状态等字段).
	 * 
	 * @param {}
	 *            options 参数对象
	 *            参考Ext.Ajax.request的options参数,其中success,failure方法追加了作用域作为参数
	 */
	doSubmit : function(options) {
		var scope = this;
		var valid = true;
		// 校验必填参数
		valid = scope.getForm().isValid();
		// alert(Ext.isArray(grid));
		var grid = scope.bodyGrid;
		// 如果没有维护明细列表
		if(grid.getStore().data.length == 0){
			Ext.ux.Toast.msg("信息", '请维护明细信息。');
			return;
		}
		var vRecords = grid.getStore().data.items; // 获取需要校验的数据数据  
		var cum = grid.getColumnModel(); // 获取列名
		// 遍历每一行数据
		for(var row = 0;row<vRecords.length;row++){
			// 遍历panel每一列  第一列ID不参与数据校验
			for(var col = 1 ; col < cum.getColumnCount(true);col++){
				// 获取编辑器
				var editor = cum.getCellEditor(col,row);
				var record = vRecords[row].data;
				var value = record[cum.getDataIndex(col)];
				if(editor){
        				// 一定要设置值才能校验 泪水。。
        				editor.field.setValue(value);
        				// 如果没有验证通过
        				if(!editor.field.validateValue(value)){
    						//给不通过校验的具体空格增加错误css样式（Ext中form的样式）  
                                            Ext.get(grid.getView().getCell(row, col)).addClass('x-form-invalid'); 
                                            valid = false;
        				}
        			}
			}
		}
		// 验证失败
		if(!valid) return;
		
		if (!options) 
			options = {};
		if (!options.params) {
			options.params = this.formatSubmitData();
		} else {
			options.params = Ext.apply(options.params, this.formatSubmitData());
		}
		if (options.success && Ext.isFunction(options.success)) {
			options.success.createDelegate(this, [scope], true);// 追加个参数
		} else {
			options.success = function(response, opts) {
				var msg = Ext.decode(response.responseText);
				if (msg.success){
					scope.fireEvent('submitsuccess', response, opts, scope);
				}else{
					Ext.Msg.show({title : "错误",msg : msg.msg,buttons : Ext.Msg.OK});
				}
			};
		}
		// 存在failure函数就追加个scope参数
		if (options.failure && Ext.isFunction(options.failure)) {
			options.failure.createDelegate(this, [scope], true);
		} else {
			options.failure = function(response, opts) {
				if (scope.on('submitfailure', response, opts, scope) === false) {
					return;
				}
				Ext.ux.Toast.msg("信息", '加载失败！请联系管理员。');
			};
		}
		options.url = options.url || scope.submitUrl || '';
		options.method = options.method || 'post';
		Ext.Ajax.request(options);
	},
	/**
	 * 查询
	 * 
	 * @param {Object}
	 *            options
	 *            参考Ext.Ajax.request的options参数,其中success,failure方法追加了作用域作为参数
	 */
	doQuery : function(options,win) {
		var scope = this;
		if (!options) {options = {};}
		options.url = Ext.isDefined(options.url)?options.url:(this.queryBillUrl||'');
		if (Ext.isDefined(options.success)) {
			options.success.createDelegate(this, [scope], true);// 追加个参数
		} else {
			options.success = function(response, opts) {
				var msg = Ext.decode(response.responseText);
				if (msg.success){
					scope.setValues(msg.result);// 赋值
				}else{
					Ext.Msg.show({title : "错误",msg : msg.msg,buttons : Ext.Msg.OK});
					if(win){win[win.closeAction]();}
				}
			};
		}
		if (Ext.isDefined(options.failure)) {
			options.failure.createDelegate(this, [scope], true);
		} else {
			options.failure = function(response, opts) {
				Ext.ux.Toast.msg("信息", '加载失败！请联系管理员。');
			};
		}
		Ext.Ajax.request(options);
	},
	/**
	 * 界面赋值
	 * 
	 * @param {Array/Object}
	 *            对象或数组,数据格式参照BasicForm中的setValues注释
	 * 
	 * @return {MasterDetailEditPanel} this
	 */
	setValues : function(values) {
		var scope = this, detailData = null;
		scope.dataClear();// 清空数据
		scope.relations = values.relations;
		var propertyNum = 0;
		for ( var i in values.details) {
			propertyNum++; // 获取属性数量
		}
		// 移除掉两个不计算的属性
		for (var i = 0; i <= propertyNum-2; i++) {
			var preItemID = values.details[i]['preItemID'];
			if(scope.detailRelations == null) {
				scope.detailRelations = {};
				scope.detailRelations[preItemID] = values.details[i].relations;
			} else {
				scope.detailRelations[preItemID] = values.details[i].relations;
			}
		}
		var newBill={};
		var billdecode = function(newObj,value,varname){
			if(Ext.isObject(value)){
				for(var v in value){
					_name = Ext.isEmpty(varname,false)?v:(varname+'.'+v);
					billdecode(newObj,value[v],_name);
				}
			}else if(Ext.isArray(value)){
				newObj[varname]=[];
				for(var i=0;i<value.length;i++){
					var _tmp ={};
					billdecode(_tmp,value[i],'');
					newObj[varname].push(_tmp);
				}
			}else {
				newObj[varname]=value;
			}
		};
		billdecode(newBill,values,'');
		////////////////////////////////////////
		this.getForm().setValues(newBill);//表头赋值
		if(Ext.isString(this.bodyEntityName)){//表体赋值
			var _v = values[this.bodyEntityName];
			if(_v && Ext.isArray(_v)){
				bs = this.getBodyGrid().store;
				if(bs){
					bs.loadData(_v);
				}
			}
		}
		else if(Ext.isArray(this.bodyEntityName)){
			//TODO 未测  this.getBodyGrid().store 与 this.getBodyStore()可能对应。问题不详
			for(var i=0;i<this.bodyEntityName.length;i++){
				var _v = values[this.bodyEntityName[i]];
				if(_v && Ext.isArray(_v)){
					var bs = this.getBodyStoreByName(this.bodyEntityName[i]);
					if(bs){bs.loadData(_v);}
				}
			}
		}
		scope.fireEvent('loaddata', scope);
	},
	/**
	 * 设置组件编辑,并添加renderer方法。
	 * 
	 * @param {Boolean}
	 *            editable true:可编辑,false:不可编辑
	 */
	setEditable : function(editable) {
		var scope = this,bg = this.getBodyGrid();
		this.editable = editable;
		var forEachHeadReadOnly=function(item){//递归设置界面元素不可编辑
			if(Ext.isObject(item)){
			    if(editable){ // 可编辑，默认不可编辑的仍然不可编辑。
				if(Ext.isDefined(item.readOnly)){
					item.setReadOnly(item.readOnly);
        				if(item.xtype=='checkbox'){
        				    item.setDisabled(item.readOnly);
        				}
				}else {
					if(Ext.isFunction(item.setReadOnly))
						item.setReadOnly(false);
					if(item.xtype=='checkbox'){
					    item.setDisabled(false);
					}
				}
			    }else{ // 不可编辑，所有的都不可编辑
				if(Ext.isFunction(item.setReadOnly))
					item.setReadOnly(true);
				if(item.xtype=='checkbox'){
				    item.setDisabled(true);
				}
			    }
        			if(item.items)
        			    forEachHeadReadOnly(item.items);
			}else if(Ext.isArray(item)){
				for(var i=0;i<item.length;i++){
					forEachHeadReadOnly(item[i]);
				}
			}
		};
		forEachHeadReadOnly(this.items);
		if(Ext.isObject(bg)){
			items = bg.getColumnModel().config;// 列组件数组
			if(bg.getTopToolbar())bg.getTopToolbar().hide();
			this.forEachSetEditable(items);
		}else if(Ext.isArray(bg)){
			Ext.each(bg,function(o){
				items = o.getColumnModel().config;
				if(o.getTopToolbar())o.getTopToolbar().hide();
				this.forEachSetEditable(items);
			},this);
		}
	},
	//private 
	forEachSetEditable:function(items){
		for (var i = 0; i < items.length; i++) {
			var rs = {xtype : null,field : null};
			rs = this.findField(items[i]);// 获取xtype和控件
			if (!Ext.isEmpty(rs.xtype, false)) {
				// 追加默认的redderer方法用于combo、日期等控件回时使用
				if (!items[i].addRendererFlag && rs.xtype && rs.xtype != 'checkcolumn') {
				    	if(!items[i].renderer){
				    	    items[i].renderer = this.findDisplayValue.createDelegate(this, [rs], true);
				    	    items[i].addRendererFlag=true;//追加方法标记。已经追加过的无需再添加
				    	}
				}
				if (this.editable) {// 可编辑
				    var flag = this.editable;
					if (Ext.isDefined(rs.field.readOnly)) {
						flag = !rs.field.readOnly;
					}
					if(flag){
        					if (flag && rs.xtype == 'checkcolumn') {
        						// XXX 通过事件控制对checkcolumn进行编辑控制，应该封装一个column
        						// 对editable单据进行处理 添加原有事件。
        						rs.field.processEvent = function(name, e, grid,rowIndex, colIndex) {
        							if (name == 'mousedown') {
        								var record = grid.store.getAt(rowIndex);
        								record.set(this.dataIndex, !record.data[this.dataIndex]);
        								return false; // Cancel row selection.
        							} else {
        								return Ext.grid.ActionColumn.superclass.processEvent.apply(this, arguments);
        							}
        						};
        					} else {
        						rs.field.setReadOnly(!flag);
        					}
					}
				} else {// 不可编辑
					if (rs.xtype == 'checkcolumn') {
						// 去除基类中对mousedown事件的逻辑
						rs.field.processEvent = function(name, e, grid,rowIndex, colIndex) {
							return Ext.grid.ActionColumn.superclass.processEvent.apply(this, arguments);
						};
					} else {
						rs.field.setReadOnly(true);
					}
				}
			}
		}
	},
	/**
	 * 清空数据
	 */
	dataClear : function() {
		this.bodyDelRecords = {};
		if (this.getForm().getEl() && this.getForm().getEl().dom) {
			this.getForm().getEl().dom.reset();
		}
		this.resetAllCheckbox();
		if (Ext.isObject(this.getBodyStore())) {
			this.getBodyGrid().store.removeAll();
			this.getBodyGrid().store.modified = [];
		} else if (Ext.isArray(this.getBodyStore())) {
			// 修改 getBodyGrid().store 与 getBodyStroe 不对应
			Ext.each(this.getBodyStore(), function(s) {
						s.removeAll();
						s.modified = [];
					});
		}
	},
	// 删行事件
	delRowAction : function(btn, e, grid) {
		var currentGrid = this.eoname;
		var rows = grid.getSelectionModel().getSelections();
		if (rows.length <= 0) {
			Ext.Msg.alert("信息", "请选择一条记录！");
			return;
		}
		var _e = {scope : this,grid : grid,record : rows,btn : btn,btnEvent : e};
		if (this.on('beforerowdel', _e) === false) {
			return;
		}
		var ridx = grid.getStore().indexOf(rows[0]);
		for (var i = 0; i < rows.length; i++) {
			grid.getStore().remove(rows[i]);
			if (!Ext.isDefined(this.bodyDelRecords[grid.eoname]))
				this.bodyDelRecords[grid.eoname]=[];
			this.bodyDelRecords[grid.eoname].push(rows[i]);
		}
		if(ridx>=0){
			grid.getSelectionModel().selectRow(ridx);
		}
		grid.getView().refresh();// 刷新 防止行号错位
		this.fireEvent('afterrowadd', e);
	},
	// 增行事件
	addRowAction : function(btn, e, grid) {
		var _record = new grid.store.recordType();// 获取一个空record
		var _e = {scope : this,grid : grid,record : _record,btn : btn,btnEvent : e};
		if (this.fireEvent('beforerowadd', _e) === false) {
			return;
		}
		var row = grid.getStore().getCount();
		grid.stopEditing();
		grid.getStore().insert(row, _record);
		grid.startEditing(row, 1);
		this.fireEvent('afterrowadd', e);
	},
	onDestroy : function() {
		OECP.ui.BasicCardBill.superclass.onDestroy.call(this);
	}
});
/**
 * 单据编辑窗口
 * @class OECP.ui.BasicCardWin
 * @extends Ext.Window
 */
OECP.ui.BasicCardWin = Ext.extend(Ext.Window,{
	/** @cfg {String}					submitUrl			保存action地址 */
	/**	@cfg {String}					queryBillUrl		读取数据action地址 */
	/** @cfg {OECP.ui.BasicCardBill} 	bill 				编辑面板 */
	/** @cfg {Array} 					btns				按钮对象 */
	
	/** @cfg {Object}					formView			视图模板 */
	/** @cfg {String}					headEntityName		主表实体名称 */
	/** @cfg {String/Array}				bodyEntityName		主表实体名称/集合 */
    	defaults :{border:false},
	layout :'fit',
	//fbar:new Ext.Toolbar({plugins : new Ext.ux.ToolbarKeyMap()}),
	reset:function(){
		this.bill.dataClear();
	},
	/** 查询*/
	doQuery:function(options){
		this.bill.doQuery(options,this);
	},
	/** 提交*/
	doSubmit:function(options){
		this.bill.doSubmit(options);
	},
	setEditable:function(editable){
		this.bill.setEditable(editable);
		this.bizSaveButton.setVisible(editable);//控制保存按钮
	},
	setStopable:function(stopable){
		if(this.bizStopButton){
			this.bizStopButton.setVisible(stopable);//控制保存按钮
		}
	},
	initBillPanel:function(){//初始化单据
		var me = this;
		if(!this.bill){
			this.bill = new OECP.ui.BasicCardBill({
				defaults:{frame:true},
//				height:me.height-50,
				width:me.width-32,
				formView:me.formView,
				submitUrl:me.submitUrl||'',
				queryBillUrl:me.queryBillUrl||'',
				headEntityName:me.headEntityName||'',
				bodyEntityName:me.bodyEntityName||'',
				bodyMutilEntityName:me.bodyMutilEntityName||'',
				transmit:function(){
					//把window里定义的store赋值到bill中
					if(me.bodyEntityName && Ext.isString(me.bodyEntityName)){
						this[me.bodyEntityName+'_cardstore_cfg'] = me[me.bodyEntityName+'_cardstore_cfg'];
					}else if(me.bodyEntityName && Ext.isArray(me.bodyEntityName)){
						for(var i=0;i<me.bodyEntityName.length;i++){
							this[me.bodyEntityName[i]+'_cardstore_cfg'] = me[me.bodyEntityName[i]+'_cardstore_cfg'];
						}
					}
				}
			});
			//保存成功事件
			this.bill.on('submitsuccess',function(){
				me[me.closeAction]();
			});
		}
		this.items=[this.bill];
	},
	//用于传递参数
	transmit:function(){},
	//初始化按钮
	initButtons:function(){
		var me = this;
		this.bizSaveButton = new OECP.ui.button.BizSaveButton();//保存
		this.bizCloseButton = new OECP.ui.button.BizCloseButton();//关闭
		if(this.stopBtnDisplay){
			this.bizStopButton = new OECP.ui.button.BizStopButton({hidden : true});//停用
			this.bizStopButton.on('click',
				function(){
				         this.bill.stop({params:{functionCode:me.functionCode}});
				},this);
		}
		this.bizEditButton = new OECP.ui.button.EditButton({hidden : true});//编辑
		this.printButton = new OECP.ui.button.PrintButton({hidden : true});//打印
		this.bizSaveButton.on('click',function(){this.bill.doSubmit({params:{functionCode:me.functionCode}});},this);
		this.bizCloseButton.on('click',function(){this[this.closeAction]();},this);
		if(this.stopBtnDisplay) {
			this.buttons =[this.bizEditButton, this.bizSaveButton, this.bizStopButton ,this.printButton,this.bizCloseButton];
		} else {
			this.buttons =[this.bizEditButton, this.bizSaveButton,this.printButton,this.bizCloseButton];
		}
	},
	initComponent:function(){
		this.transmit();
		this.initBillPanel();
		this.initButtons();
		OECP.ui.BasicCardWin.superclass.initComponent.call(this);
		// 增加并初始化“按钮快捷键插件”
		this.fbar.plugins = new Ext.ux.ToolbarKeyMap();
		this.fbar.plugins.init(this.fbar);
		// 窗体show时，变回车为tab
		this.on("show",function(){
			keyNav(this.bill,0);
		},this);
	},
	onDestroy:function(){
		OECP.ui.BasicCardWin.superclass.onDestroy.call(this);
	}
});
// Form内字段编辑时横向“回车”变为Tab,并默认第一个字段获得焦点
var keyNav = function(ep ,xFocus){
    var run=function(){
        var all=Ext.DomQuery.select('input[type!=hidden]{display!=none}',ep.body.dom); //查找所有非隐藏的录入项（ext中select都是用input模拟的所以这里不用找select）
        Ext.each(all,function(o,i,all){ //遍历并添加enter的监听
            Ext.get(o).addKeyMap({
                key : 13,
                fn : function(key,event) {
                    try{all[i+1].focus();}catch(e){event.keyCode=9;}
                    if(all[i+1]&&/button|reset|submit/.test(all[i+1].type)) all[i+1].click();   //如果是按钮则触发click事件
                    return true;
                }
            });
        });
        function defFocus(){
	        ep.body.dom.focus();  //使页面获取焦点，否则下面设定默认焦点的功能有时不灵验
	        try{
	            var el;
	            if(typeof eval(xFocus)=='object'){  //如果传入的是id或dom节点
	                el=Ext.getDom(xFocus).tagName=='input'?Ext.getDom(xFocus):Ext.get(xFocus).first('input',true);  //找到input框
	            }else{
	                el=all[xFocus||0];  //通过索引号找
	            }
	            el.focus();
	        }catch(e){} 
        }
        setTimeout(defFocus, 10);
    }
    Ext.isReady?run():Ext.onReady(run);  //页面加载完成后添加表单导航
};